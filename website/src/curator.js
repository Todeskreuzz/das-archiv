/**
 * Der Kurator.
 *
 * Diese Datei ist die KI-Schnittstelle des Hauses. Im Demo-Betrieb arbeitet sie
 * regelbasiert und offline; dieselbe Funktionssignatur kann später an ein
 * Sprachmodell weitergereicht werden (siehe README, Abschnitt "KI anbinden").
 */
import { hash, pickSeeded } from './util.js';
import { tally } from './logic.js';

const SPAM = ['casino', 'kredit', 'viagra', 'porno', 'sexkontakt', 'gewinnspiel', 'krypto', 'forex', 'abnehmen'];
const SIGNAL = ['klassiker', 'archiv', 'erste', '1990', '2000', 'forum', 'chat', 'community', 'portal', 'browserspiel', 'weblog', 'blog', 'gif', 'webring', 'modem', 'mailbox'];
const KNOWN_TLDS = ['de', 'at', 'ch'];

export const VERDICTS = {
  aufnehmen: { label: 'Aufnehmen', tone: 'grün' },
  prüfen: { label: 'Prüfen', tone: 'gelb' },
  ablehnen: { label: 'Ablehnen', tone: 'rot' },
};

export function parseHost(url) {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    if (!parsed.hostname.includes('.')) return null;
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** example.de und blog.example.de gehören zusammen. */
export function baseDomain(host) {
  if (!host) return '';
  const parts = host.split('.');
  return parts.slice(-2).join('.');
}

/**
 * Bewertet einen Einreichungsvorschlag.
 * @param {{title:string,url:string,note?:string,kind?:string}} input
 * @param {Array} archive bestehende Exponate
 */
export function judge(input, archive) {
  const reasons = [];
  const title = String(input.title || '').trim();
  const url = String(input.url || '').trim();
  const note = String(input.note || '').trim();
  const host = parseHost(url);
  let score = 50;

  if (!title || title.length < 2) {
    return finish(0, 'ablehnen', ['Ohne Titel kann ich nichts katalogisieren.'], input, null);
  }
  if (title.length < 4) {
    score -= 10;
    reasons.push('Der Titel ist sehr kurz — ich ergänze ihn später.');
  }
  if (title.length > 80) {
    score -= 12;
    reasons.push('Der Titel ist länger als eine Schildzeile.');
  }

  if (!url) {
    score -= 18;
    reasons.push('Keine Adresse angegeben. Ein Fund ohne Herkunft ist ein Gerücht.');
  } else if (!host) {
    score -= 25;
    reasons.push('Die Adresse ergibt keine gültige Domain.');
  } else {
    const tld = host.split('.').pop();
    if (KNOWN_TLDS.includes(tld)) {
      score += 14;
      reasons.push(`Domain „${host}“ liegt im deutschen Sprachraum — das passt in dieses Haus.`);
    } else {
      score -= 6;
      reasons.push(`„${host}“ liegt außerhalb des deutschen Sprachraums. Ich prüfe den Bezug streng.`);
    }
    if (archive.some((entry) => baseDomain(parseHost(entry.url)) === baseDomain(host))) {
      score -= 40;
      reasons.push(`Diese Domain ist bereits im Bestand. Doppelungen kosten nur Platz.`);
    }
  }

  const haystack = `${title} ${url} ${note}`.toLowerCase();
  const spam = SPAM.find((word) => haystack.includes(word));
  if (spam) {
    score -= 60;
    reasons.push(`Ich erkenne das Muster „${spam}“. Das ist kein Denkmal, das ist Werbung.`);
  }

  const signals = SIGNAL.filter((word) => haystack.includes(word));
  if (signals.length) {
    score += Math.min(18, signals.length * 6);
    reasons.push(`Ich zähle ${signals.length} Hinweis${signals.length === 1 ? '' : 'e'} auf Netzkultur: ${signals.slice(0, 3).join(', ')}.`);
  }

  if (note.length > 60) {
    score += 6;
    reasons.push('Die eigene Notiz ist brauchbar — ich kann daran anknüpfen.');
  }
  const yearMatch = haystack.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (yearMatch) {
    score += 8;
    reasons.push(`Eine Jahreszahl ist greifbar (${yearMatch[1]}). Damit kann ich das Stück einordnen.`);
  }

  score = Math.max(0, Math.min(100, score));

  let verdict = 'prüfen';
  if (score >= 68) verdict = 'aufnehmen';
  else if (score < 38) verdict = 'ablehnen';

  if (!reasons.length) reasons.push('Ich habe zu wenig Anhaltspunkte und rate nicht.');

  return finish(score, verdict, reasons, input, host);
}

function finish(score, verdict, reasons, input, host) {
  const kind = input.kind || guessKind(input);
  const rarity = score >= 80 ? 'einzigartig' : score >= 58 ? 'selten' : 'verbreitet';
  return {
    score,
    verdict,
    reasons,
    host,
    kind,
    rarity,
    text: draftText(input, { kind, rarity, score }),
  };
}

function guessKind(input) {
  const h = `${input.title} ${input.note}`.toLowerCase();
  if (h.includes('spiel') || h.includes('game')) return 'Browserspiel';
  if (h.includes('forum') || h.includes('board')) return 'Forum';
  if (h.includes('blog')) return 'Weblog';
  if (h.includes('chat')) return 'Chat';
  if (h.includes('wiki')) return 'Enzyklopädie';
  if (h.includes('gif') || h.includes('grafik') || h.includes('bild')) return 'Grafik';
  return 'Webseite';
}

function draftText(input, meta) {
  const title = String(input.title || 'Der Fund').trim();
  const note = String(input.note || '').trim();
  const opening = pickSeeded(
    [
      `${title} gehört zu den Stücken, bei denen ich kurz innehalte.`,
      `Ich habe ${title} geprüft und für aufnahmefähig befunden.`,
      `${title} ist kein lautes Denkmal, aber ein genaues.`,
      `Man übersieht ${title} leicht. Das wäre ein Fehler.`,
    ],
    title,
  );
  const middle = note
    ? `Der Hinweis zur Einreichung lautet: ${note}`
    : 'Eine Beschreibung fehlt noch — ich ergänze sie, sobald ich das Stück eingeordnet habe.';
  return `${opening} ${middle} Ich führe es als ${meta.kind} mit dem Vermerk „${meta.rarity}“.`;
}

/** Kurze Reaktion des Kurators auf ein Ereignis. */
export function react(event, payload = {}, seed = '') {
  const lines = {
    restore: [
      'Gut. Wieder ein Stück, das nicht verschwindet.',
      'Notiert. Ich lasse das Licht in diesem Saal noch etwas länger brennen.',
      'Danke. Das war keine Arbeit, das war eine Rettung.',
      'Ich sehe es. Der Bestand wächst leise.',
    ],
    vote: [
      'Deine Stimme ist im Protokoll. Ich wiege sie mit.',
      'Notiert. Das Gremium hat gesprochen — ich höre zu.',
      'Eine Stimme mehr für die Nachwelt. Oder dagegen. Beides ist ehrlich.',
    ],
    submit: [
      'Ich habe den Fund gelesen. Er liegt jetzt auf meinem Tisch.',
      'Ein neuer Vorschlag. Ich prüfe ihn, bevor ich ihn lobe.',
    ],
    accepted: [
      'Angenommen. Ich trage es eigenhändig ein.',
      'Das Gremium und ich sind uns einig. Willkommen im Bestand.',
    ],
    rejected: [
      'Abgelehnt. Nicht aus Hochmut — aus Platz.',
      'Nein. Aber ich bewahre die Ablehnung auf, falls wir uns irren.',
    ],
    welcome: [
      'Willkommen im Archiv. Ich bin der Kurator.',
      'Du bist früh. Die Räume sind noch kalt.',
    ],
  };
  const pool = lines[event] || lines.welcome;
  return pickSeeded(pool, `${event}${seed}${payload.id || ''}`);
}

export function briefing(state, entries) {
  const total = entries.length;
  const secured = entries.filter((entry) => state.restored[entry.id]).length;
  const open = total - secured;
  const lines = [
    `${total} Stücke im Haus, ${secured} davon angesehen. ${open} warten noch.`,
    `Ich habe die Vitrinen geprüft. Es fehlt nichts, es fehlt nur Aufmerksamkeit.`,
    'Heute ist ein guter Tag für ein Stück, das niemand vermisst.',
    'Ich führe dieses Haus, solange jemand hereinkommt. Du bist hereingekommen.',
  ];
  return pickSeeded(lines, `${state.log.length}-${secured}`);
}

/** Erklärt, wie der Kurator über einen Kandidaten denkt. */
export function explainCandidate(candidate) {
  const vote = candidate.curatorVote || 0;
  const title = candidate.title;
  const pool =
    vote > 0
      ? [
          `Ich stimme dafür. ${title} erzählt etwas, das sonst nur in alten Forenthreads überlebt hätte.`,
          `Mein Votum ist positiv. Ich will ${title} nicht in einer Fußnote enden sehen.`,
          `${title} gehört hierher — nicht weil es groß war, sondern weil es genau war.`,
          `Ich stimme dafür, mit einem Vorbehalt: ${title} muss belegt werden, nicht nur behauptet.`,
        ]
      : vote < 0
        ? [
            `Ich habe Bedenken. ${title} hat Spuren hinterlassen — aber nicht jede Spur gehört ins Museum.`,
            `Ich rate ab. Was ${title} hinterlässt, ist weniger Erbe als Aufregung.`,
            `Mein Votum ist negativ. Ich kann ${title} dokumentieren, ohne es zu adeln.`,
          ]
        : [
            `Ich enthalte mich. Bei ${title} sehe ich Argumente auf beiden Seiten.`,
            `Kein Votum. ${title} liegt mir zu nah an der Grenze zwischen Zeitzeugnis und Zeitvertreib.`,
            `Ich lasse das Gremium entscheiden. ${title} ist nicht meine Entscheidung allein.`,
          ];
  return pickSeeded(pool, candidate.id);
}

export function voteSpeech(candidate, votes) {
  const result = tally(candidate, votes);
  if (result.passed) return `${candidate.title} hat das Quorum erreicht. Ich trage es ein — gegen meinen eigenen Zweifel.`;
  if (result.net < 0) return `${candidate.title} liegt unter null. Ich lege den Vorgang in die Ablage „später vielleicht“.`;
  return `${candidate.title} steht bei ${result.net} Netto-Stimmen. Es fehlen ${Math.max(0, result.quorum - result.net)}.`;
}

export function signature(seed) {
  return pickSeeded(
    ['— K., im Vorbeigehen', '— Kurator, Protokoll 4', '— ich, leise', '— K. für das Haus'],
    hash(String(seed)),
  );
}
