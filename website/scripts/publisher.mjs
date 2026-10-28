import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { poster } from '../src/data/art.js';
import { esc } from '../src/util.js';

/**
 * Der Kurator stellt aus.
 *
 * Baut eine statische Seite in docs/ausstellung/, trägt sie in den Index ein
 * und kann sie auf Wunsch committen und pushen. GitHub Pages liefert daraus
 * eine öffentliche Ausstellung.
 */

const root = fileURLToPath(new URL('../../', import.meta.url));
const docs = join(root, 'docs');
const folder = join(docs, 'ausstellung');
const manifestFile = join(folder, 'index.json');

const CSS = `
:root{--bg:#05070c;--ink:#e8e2d0;--dim:#8b96ae;--faint:#5d6470;--amber:#ffcf6a;--cyan:#6ee7d7;
  --mono:"Cascadia Mono",Consolas,"Courier New",monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--mono);line-height:1.6;
  background-image:radial-gradient(900px 500px at 50% 0%,#131c30 0%,transparent 60%)}
.wrap{max-width:1100px;margin:0 auto;padding:48px 24px 80px}
.kicker{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--faint)}
h1{font-family:Georgia,serif;font-size:clamp(2rem,5vw,3.4rem);letter-spacing:.02em;margin:.3em 0 .2em}
.lead{max-width:64ch;color:var(--dim);font-size:14px}
.rule{height:1px;background:#e8e2d022;margin:36px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:28px}
.card{border:1px solid #e8e2d01f;background:#080b12;padding:10px;text-decoration:none;color:inherit;
  transition:border-color .2s,transform .2s}
.card:hover{border-color:var(--amber);transform:translateY(-3px)}
.card svg{display:block;width:100%;height:auto;filter:contrast(1.08) saturate(.72)}
.card h2{font-family:Georgia,serif;font-size:17px;margin:10px 2px 2px;font-weight:600}
.card p{margin:0 2px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.card .text{font-size:11px;line-height:1.55;color:var(--dim);margin:8px 2px 4px;text-transform:none;letter-spacing:0}
footer{margin-top:56px;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
a{color:var(--amber)}
`;

function page({ title, kicker, lead, body, footer }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Das Archiv</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <p class="kicker">${esc(kicker)}</p>
  <h1>${esc(title)}</h1>
  <p class="lead">${esc(lead)}</p>
  <div class="rule"></div>
  ${body}
  <footer>${footer || 'Das Archiv — Deutsches Internet-Museum'}</footer>
</div>
</body>
</html>`;
}

export function exhibitionPage({ title, intro, entries, date }) {
  const cards = entries
    .map(
      (entry) => `
  <article class="card">
    ${poster(entry)}
    <h2>${esc(entry.title)}</h2>
    <p>${esc(String(entry.year || '—'))} · ${esc(entry.kind)}</p>
    <div class="text">${esc(entry.text)}</div>
  </article>`,
    )
    .join('');

  return page({
    title,
    kicker: `Ausstellung · ${date}`,
    lead: intro,
    body: `<div class="grid">${cards}</div>`,
    footer: `Zusammengestellt vom Kurator · ${entries.length} Stücke · <a href="../">alle Ausstellungen</a>`,
  });
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch {
    return { items: [] };
  }
}

function writeIndex(manifest) {
  const items = manifest.items
    .slice()
    .reverse()
    .map(
      (item) => `
  <article class="card">
    <h2>${esc(item.title)}</h2>
    <p>${esc(item.date)} · ${item.count} Stücke</p>
    <div class="text">${esc(item.intro)}</div>
    <p style="margin-top:10px"><a href="./ausstellung/${esc(item.slug)}.html">Ausstellung öffnen →</a></p>
  </article>`,
    )
    .join('');

  const html = page({
    title: 'Das Archiv — Ausstellungen',
    kicker: 'Deutsches Internet-Museum',
    lead:
      'Was der Kurator gefunden, geprüft und für würdig befunden hat. Jede Ausstellung ist eine kleine Sammlung, ' +
      'zusammengestellt von einer KI, die das Haus führt.',
    body: items || '<p class="lead">Noch keine Ausstellung veröffentlicht.</p>',
    footer: `Stand ${new Date().toISOString().slice(0, 10)}`,
  });

  writeFileSync(join(docs, 'index.html'), html, 'utf8');
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function publishExhibition({ title, intro, entries, push = true }) {
  if (!entries.length) throw new Error('Keine Stücke für die Ausstellung');

  const date = new Date().toISOString().slice(0, 10);
  const slug = `${date}-${String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)}`;

  mkdirSync(folder, { recursive: true });

  writeFileSync(join(folder, `${slug}.html`), exhibitionPage({ title, intro, entries, date }), 'utf8');

  const manifest = readManifest();
  manifest.items = manifest.items.filter((item) => item.slug !== slug);
  manifest.items.push({ slug, title, intro, date, count: entries.length });
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  writeIndex(manifest);

  const url = `https://todeskreuzz.github.io/das-archiv/ausstellung/${slug}.html`;
  let pushed = false;
  let error = null;

  if (push) {
    try {
      git(['add', 'docs']);
      git(['commit', '-m', `Ausstellung: ${title} (${entries.length} Stuecke)`]);
      git(['push']);
      pushed = true;
    } catch (exception) {
      error = String(exception.stderr || exception.message || exception).slice(0, 300);
    }
  }

  return { url, slug, file: join(folder, `${slug}.html`), pushed, error };
}

export function hasPages() {
  return existsSync(join(docs, 'index.html'));
}
