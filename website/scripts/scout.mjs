/**
 * Der Scout.
 *
 * Läuft auf dem Server, nicht im Browser. Er besucht deutsche Seiten,
 * respektiert robots.txt, liest Titel und Beschreibung, verwirft Doppelungen
 * und legt brauchbare Funde dem Gremium vor.
 *
 * Ohne Sprachmodell schreibt er die Beschreibung selbst.
 * Mit Schlüssel darf das Modell sie formulieren.
 */

const SEEDS = [
  'https://de.wikipedia.org/wiki/Moorhuhn',
  'https://de.wikipedia.org/wiki/StudiVZ',
  'https://de.wikipedia.org/wiki/Bildschirmtext',
  'https://de.wikipedia.org/wiki/Krautchan',
  'https://de.wikipedia.org/wiki/Netzpolitik.org',
  'https://de.wikipedia.org/wiki/Liste_von_Online-Communitys',
  'https://de.wikipedia.org/wiki/Geschichte_des_Internets',
  'https://www.heise.de',
  'https://netzpolitik.org',
  'https://blog.fefe.de',
];

const SKIP = /(impressum|datenschutz|kontakt|agb|login|anmelden|warenkorb|checkout|cookie|feed|rss|\.pdf$|\.jpg$|\.png$|\.zip$)/i;
const SIGNAL = /(archiv|internet|web|forum|chat|community|blog|spiel|browser|modem|mailbox|homepage|portal|netzkultur|retro|199\d|200\d)/i;
const ALLOWED_TLD = /\.(de|at|ch|org|net|com)$/i;

const USER_AGENT = 'DasArchivBot/1.0 (+https://github.com/Todeskreuzz/das-archiv)';

function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function clean(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function createScout({ onFind, isKnown, onLog }) {
  const queue = SEEDS.map((url) => ({ url, depth: 0 }));
  const seen = new Set();
  const robots = new Map();
  let lastScan = 0;

  function parseRobots(text) {
    const groups = [];
    let current = null;
    for (const raw of text.split('\n')) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      const index = line.indexOf(':');
      if (index < 0) continue;
      const key = line.slice(0, index).trim().toLowerCase();
      const value = line.slice(index + 1).trim();

      if (key === 'user-agent') {
        if (!current || current.rules.length) {
          current = { agents: [], rules: [] };
          groups.push(current);
        }
        current.agents.push(value.toLowerCase());
      } else if ((key === 'disallow' || key === 'allow') && current) {
        current.rules.push({ allow: key === 'allow', path: value });
      }
    }
    return groups;
  }

  async function robotsAllowed(url) {
    try {
      const { origin, pathname } = new URL(url);
      if (!robots.has(origin)) {
        const response = await fetch(`${origin}/robots.txt`, {
          headers: { 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(4000),
        });
        const text = response.ok ? await response.text() : '';
        robots.set(origin, parseRobots(text.slice(0, 40000)));
      }

      const groups = robots.get(origin);
      if (!groups || !groups.length) return true;

      const rules = groups
        .filter((group) => group.agents.includes('*') || group.agents.some((agent) => USER_AGENT.toLowerCase().includes(agent)))
        .flatMap((group) => group.rules)
        .filter((rule) => rule.path && pathname.startsWith(rule.path));

      if (!rules.length) return true;
      // Die längste Regel gewinnt.
      rules.sort((a, b) => b.path.length - a.path.length);
      return rules[0].allow;
    } catch {
      return true;
    }
  }

  async function fetchPage(url) {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      signal: AbortSignal.timeout(7000),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('html')) throw new Error('kein HTML');
    const text = await response.text();
    return text.slice(0, 400000);
  }

  function extract(html, url) {
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i) || [])[1] || '';

    const rawTitle = clean(ogTitle ? ogTitle[1] : titleTag ? titleTag[1] : '').slice(0, 120);
    const title = rawTitle.replace(/\s*[–|-]\s*(Wikipedia|Heise|heise online|Golem\.de)\s*$/i, '').trim();

    // Erster Absatz als Notlösung, wenn keine Meta-Beschreibung da ist
    const firstParagraph = html.match(/<p[^>]*>([\s\S]{60,1400}?)<\/p>/i);
    const lead = clean(firstParagraph ? firstParagraph[1] : '').slice(0, 280);

    const links = [];
    const linkPattern = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match = linkPattern.exec(html);
    let guard = 0;
    while (match && guard < 120) {
      guard += 1;
      try {
        const next = new URL(match[1], url);
        if (next.protocol.startsWith('http') && !SKIP.test(next.pathname)) {
          links.push({ url: next.href.split('#')[0], text: clean(match[2]).slice(0, 80) });
        }
      } catch {
        /* kaputte Links ignorieren */
      }
      match = linkPattern.exec(html);
    }

    return {
      url,
      title,
      description: clean(description ? description[1] : '').slice(0, 300) || lead,
      lang: lang.slice(0, 5),
      links,
    };
  }

  function score(meta) {
    let points = 0;
    const host = new URL(meta.url).hostname;
    if (ALLOWED_TLD.test(host)) points += 20;
    if (/^de/i.test(meta.lang)) points += 15;
    if (meta.title.length >= 8 && meta.title.length <= 100) points += 10;
    if (meta.description.length > 50) points += 12;
    if (SIGNAL.test(`${meta.title} ${meta.description}`)) points += 18;
    if (SKIP.test(meta.url)) points -= 40;
    if (meta.url.split('/').length > 6) points -= 8;
    return Math.max(0, Math.min(100, points));
  }

  function makeEntry(meta) {
    const host = new URL(meta.url).hostname.replace(/^www\./, '');
    const year = (meta.description + meta.title).match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    const kind = /spiel/i.test(meta.title) ? 'Browserspiel' : /blog/i.test(meta.title) ? 'Weblog' : 'Webseite';
    return {
      id: `scout-${hash(meta.url)}`,
      room: kind === 'Browserspiel' ? 'spielhalle' : 'bibliothek',
      title: meta.title || host,
      host,
      url: meta.url,
      year: year ? Number(year[1]) : null,
      kind,
      rarity: 'verbreitet',
      accent: ['#6ee7d7', '#ffcf6a', '#ff8a5b', '#9ab8ff', '#ff4d9d'][hash(meta.url).charCodeAt(0) % 5],
      motif: 'crt',
      tags: ['Fund', 'automatisch'],
      text: meta.description
        ? `${meta.title} — ${meta.description} Gefunden beim Durchsuchen des deutschen Netzes; ich habe es geprüft und für aufnahmefähig befunden.`
        : `${meta.title}. Gefunden beim Durchsuchen des deutschen Netzes. Mehr stand nicht auf der Seite, aber der Fund ist echt.`,
      note: `Automatisch gefunden auf ${host}.`,
      curatorVote: 1,
      seedYes: 2,
      seedNo: 0,
      source: 'scanner',
    };
  }

  async function scan() {
    if (Date.now() - lastScan < 45000) return null;
    lastScan = Date.now();

    let attempts = 0;
    while (queue.length && attempts < 8) {
      attempts += 1;
      const next = queue.shift();
      const url = next.url;
      if (seen.has(url) || (isKnown && isKnown(url)) || SKIP.test(url)) continue;
      seen.add(url);

      try {
        if (!(await robotsAllowed(url))) continue;
        const html = await fetchPage(url);
        const meta = extract(html, url);
        if (!meta.title) continue;

        const points = score(meta);
        onLog?.(`geprüft: ${meta.title} (${points})`);

        if (next.depth < 2) {
          for (const link of meta.links.slice(0, 14)) {
            if (!seen.has(link.url) && ALLOWED_TLD.test(new URL(link.url).hostname)) {
              queue.push({ url: link.url, depth: next.depth + 1 });
            }
          }
        }

        if (points >= 48 && meta.description.length > 40) {
          const entry = makeEntry(meta);
          onFind?.(entry, meta);
          return entry;
        }
      } catch {
        /* Seite nicht erreichbar — weiter. */
      }
    }

    return null;
  }

  return { scan, queue, seen };
}
