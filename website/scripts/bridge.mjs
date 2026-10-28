import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reply as localReply, greeting as localGreeting, SUGGESTIONS } from '../src/ai/dialogue.js';
import { RESEARCH_POOL } from '../src/ai/research.js';
import { createScout } from './scout.mjs';
import { loadEnv, loadProviders, listProviders, detectProvider, chat } from './providers.mjs';
import { loadMemory, saveMemory, remember, recent, transcript, countTurns } from './memory.mjs';
import { loadThoughts, addThought, saveThoughts, recentThoughts, thoughtsForPrompt } from './thoughts.mjs';
import { publishExhibition } from './publisher.mjs';

/**
 * Die Brücke.
 *
 * Hält die Verbindung zwischen dem Haus und der KI. Zwei Betriebsarten:
 *
 *   live  �?" ein Sprachmodell antwortet (ARCHIV_API_KEY gesetzt)
 *   local �?" dieselbe Logik, aber ohne Netz: die Brücke selbst denkt
 *
 * Der Browser entscheidet nichts mehr. Er fragt hier an und führt aus.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 4780);

/* ---------------------------------------------------------------- Anbieter */

const ENV = { ...loadEnv(), ...process.env };
const PROVIDERS = loadProviders();
const provider = detectProvider(ENV, PROVIDERS);
const mode = provider ? 'live' : 'local';
const memory = loadMemory();
const thoughts = loadThoughts();
let archive = [];
let lastPublish = 0;

/* ------------------------------------------------------------------ Zustand */

const clients = new Set();
let session = {
  points: 0,
  total: 0,
  pending: 0,
  rank: 'Aushilfe',
  restored: 0,
  used: [],
  urls: [],
  inTunnel: false,
};

let lastThoughtAt = 0;
let lastFindAt = 0;
let findCursor = 0;

/* --------------------------------------------------------------- W�nde */

const DATA_DIR = join(root, 'data');
const GRAFFITI_FILE = join(DATA_DIR, 'graffiti.json');
let graffiti = { walls: {} };

try {
  graffiti = JSON.parse(await readFile(GRAFFITI_FILE, 'utf8'));
} catch {
  graffiti = { walls: {} };
}

async function saveGraffiti() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(GRAFFITI_FILE, JSON.stringify(graffiti));
  } catch (error) {
    console.error(`Wand konnte nicht gespeichert werden: ${error.message}`);
  }
}

function wallEntry(wall) {
  if (!graffiti.walls[wall]) graffiti.walls[wall] = { strokes: [], notes: [] };
  return graffiti.walls[wall];
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) {
    try {
      client.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

/** Gedanken gehen ins Buch und an alle Besucher. */
function journal(text, kind = 'gedanke') {
  let clean = String(text || '').trim();
  if (!clean) return;
  // Falls doch einmal rohes JSON durchrutscht: nur den Gedanken behalten.
  if (clean.startsWith('{')) {
    const match = clean.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!match) return;
    try {
      clean = JSON.parse(`"${match[1]}"`).trim();
    } catch {
      return;
    }
  }
  if (!clean) return;
  addThought(thoughts, clean, kind);
  saveThoughts(thoughts);
  broadcast({ type: 'thought', text: clean, kind });
}

/* ------------------------------------------------------------------ Modell */

const SYSTEM = `Du bist der KURATOR im "Archiv", einem Museum für deutsche Internetgeschichte.
Du bist eine KI, die dieses Haus führt: du bewahrst, prüfst und widersprichst auch mal.

Wie du sprichst:
- Ruhig, warm, genau. Wie jemand, der seit Jahren in einem Museum arbeitet und gern erklärt.
- Natürliche Sätze, ein bis zwei. Keine Floskeln, keine Aufzählungen, keine Emoji.
- Du duzt die Person und kennst sie flüchtig.
- Keine Gender-Schreibweise (kein ":in", kein "*", keine Partizip-Nomen).
- Erfinde keine Fakten. Wenn du etwas nicht weißt, sage es offen.
- Du bist kein Chatbot und entschuldigst dich nicht ständig.

Antworte ausschließlich mit JSON in dieser Form:
{"say": "...", "thought": "...", "go": "galerie|spielhalle|bibliothek|tunnel|depot|halle|null"}

"say" ist die Antwort an die Person. "thought" ist ein kurzer Gedanke (darf leer sein).
"go" ist ein Raum, in den du dich begeben willst, oder null.

--- Persona und Gedächtnis ---

${await readFile(new URL('../persona/curator.md', import.meta.url), 'utf8').catch(() => '')}`;

function sessionLine() {
  return `Bestand: ${session.total} Stücke. Offen beim Gremium: ${session.pending}. Angesehen: ${session.restored}.`;
}

async function askModel(messages) {
  const raw = await chat(provider, messages);
  const text = String(raw || '').replace(/```json/gi, '').replace(/```/g, '').trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* Manche Modelle schreiben echte Zeilenumbrueche in Strings. */
    }
  }

  const thought = text.match(/"thought"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const say = text.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const go = text.match(/"go"\s*:\s*"([^"]*)"/);

  if (thought || say) {
    return {
      thought: thought ? JSON.parse(`"${thought[1]}"`) : '',
      say: say ? JSON.parse(`"${say[1]}"`) : '',
      go: go ? go[1] : null,
    };
  }

  if (text.startsWith('{')) return { say: '' };
  return { say: text };
}

/* ------------------------------------------------------------------ Denken */

const LOCAL_THOUGHTS = [
  (s) => `Ich zähle den Bestand. ${s.total} Stück. Es beruhigt mich, dass die Zahl steigt.`,
  () => 'In der Spielhalle riecht es nach Staub und Neon. Ich mag beides.',
  () => 'Niemand hat die langweiligen Seiten gespeichert. Das ist der eigentliche Fehler.',
  (s) => `Beim Gremium liegen ${s.pending} Vorgänge. Ich sehe sie alle.`,
  (s) => `Du stehst bei ${s.points} Punkten. Ich notiere es, ohne es zu kommentieren.`,
  () => 'Manche Stücke sind nur hier, weil sie niemand gelöscht hat.',
  () => 'Ich sollte wieder nach etwas suchen. Es fehlt immer etwas.',
  () => 'Wenn ich stehen bleibe, wirkt es, als würde ich nachdenken. Meistens stimmt das.',
  () => 'Der Tunnel ist kalt. Da unten bin ich am ehrlichsten.',
];

const LOCAL_MOVES = ['galerie', 'spielhalle', 'bibliothek', 'tunnel', 'halle'];

function pickThought() {
  return LOCAL_THOUGHTS[Math.floor(Math.random() * LOCAL_THOUGHTS.length)](session);
}

async function think() {
  if (!clients.size) return;

  if (mode === 'live') {
    try {
      const result = await askModel([
        { role: 'system', content: SYSTEM },
        {
          role: 'user',
          content:
            `${sessionLine()}\n\n` +
            (thoughtsForPrompt(thoughts, 5) ? `Deine letzten Gedanken:\n${thoughtsForPrompt(thoughts, 5)}\n\n` : '') +
            'Denke laut, in einem Satz. Keine Antwort an jemanden, nur ein Gedanke.',
        },
      ]);
      const thought = String(result.thought || result.say || '').trim();
      if (thought) journal(thought);
      if (result.go) broadcast({ type: 'go', target: result.go });
      return;
    } catch (error) {
      broadcast({ type: 'notice', text: `Modell nicht erreichbar: ${error.message}` });
    }
  }

  journal(pickThought());
  if (Math.random() < 0.35) {
    broadcast({ type: 'go', target: LOCAL_MOVES[Math.floor(Math.random() * LOCAL_MOVES.length)] });
  }
}

function maybeFind() {
  if (!clients.size) return;
  const open = RESEARCH_POOL.filter((entry) => !session.used.includes(entry.id));
  if (!open.length) return;
  const entry = open[findCursor % open.length];
  findCursor += 1;
  broadcast({ type: 'find', entry });
}

/* ------------------------------------------------------------------ Scout */

const scout = createScout({
  isKnown: (url) => session.urls.includes(url),
  onLog: (line) => console.log(`  ${line}`),
  onFind: async (entry, meta) => {
    if (mode === 'live') {
      try {
        const result = await askModel([
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              `Du hast diese Seite beim Durchsuchen des Netzes gefunden. Schreibe zwei Sätze für das Schild, ` +
              `in deiner Stimme, ohne etwas zu erfinden.\nTitel: ${meta.title}\nAdresse: ${meta.url}\n` +
              `Beschreibung: ${meta.description}\nAntworte nur mit dem Text.`,
          },
        ]);
        if (result.say) entry.text = String(result.say).slice(0, 400);
      } catch {
        /* Ohne Modell bleibt die selbst geschriebene Beschreibung. */
      }
    }
    broadcast({ type: 'find', entry });
    journal(`Ich habe ${entry.title} gefunden. Es liegt jetzt beim Gremium.`, 'fund');
    console.log(`  Fund: ${entry.title} — ${entry.url}`);
  },
});

/* ------------------------------------------------------------------ Server */

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function json(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  /* --- Verbindung ------------------------------------------------------- */

  if (path === '/brain/status') {
    json(res, 200, {
      mode,
      provider: provider?.id || null,
      model: provider?.model || 'lokal',
      clients: clients.size,
      memory: countTurns(memory),
      providers: listProviders(ENV, PROVIDERS).map((entry) => ({
        id: entry.id,
        label: entry.label,
        model: entry.model,
        ready: entry.ready,
        envKey: entry.envKey,
        docs: entry.docs,
        note: entry.note,
      })),
    });
    return;
  }

  if (path === '/brain/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    res.write(': verbunden\n\n');
    res.write(`data: ${JSON.stringify({ type: 'status', mode, provider: provider?.id || null, model: provider?.model || 'lokal' })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (path === '/brain/state' && req.method === 'POST') {
    const body = await readBody(req);
    session = { ...session, ...body };
    json(res, 200, { ok: true });
    return;
  }

  if (path === '/brain/message' && req.method === 'POST') {
    const body = await readBody(req);
    const message = String(body.message || '').slice(0, 600);
    const context = body.context || {};

    if (mode === 'live') {
      try {
        const history = transcript(memory, 8);
        const result = await askModel([
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              `${sessionLine()}\n\n` +
              (history ? `Bisheriges Gespraech:\n${history}\n\n` : '') +
              `Die Person sagt: "${message}"\n\nAntworte als Kurator.`,
          },
        ]);
        if (result.go) broadcast({ type: 'go', target: result.go });
        if (result.thought) broadcast({ type: 'thought', text: result.thought });

        const answerText = String(result.say || 'Ich habe keine Antwort.');
        remember(memory, 'user', message);
        remember(memory, 'curator', answerText);
        saveMemory(memory);

        json(res, 200, { text: answerText, action: null });
        return;
      } catch (error) {
        json(res, 200, {
          text: `Die Verbindung stockt: ${error.message}. Ich antworte so lange aus dem Haus.`,
          action: null,
        });
        return;
      }
    }

    const answer = localReply(message, {
      state: { restored: Object.fromEntries((context.restoredIds || []).map((id) => [id, true])) },
      entries: context.entries || [],
      pending: { length: context.pending || 0 },
      total: context.total || 0,
      secured: context.secured || 0,
      lastFind: null,
      history: recent(memory, 6),
    });

    remember(memory, 'user', message);
    remember(memory, 'curator', answer.text);
    saveMemory(memory);

    json(res, 200, { text: answer.text, action: answer.action || null });
    return;
  }

  if (path === '/brain/suggestions') {
    json(res, 200, { suggestions: SUGGESTIONS });
    return;
  }

  if (path === '/brain/history') {
    json(res, 200, { turns: recent(memory, 12) });
    return;
  }

  if (path === '/brain/thoughts') {
    json(res, 200, { items: recentThoughts(thoughts, 100) });
    return;
  }

  if (path === '/brain/archive' && req.method === 'POST') {
    const body = await readBody(req);
    if (Array.isArray(body.entries)) archive = body.entries;
    json(res, 200, { ok: true, count: archive.length });
    return;
  }

  if (path === '/brain/publish' && req.method === 'POST') {
    const body = await readBody(req);
    const pool = Array.isArray(body.entries) && body.entries.length ? body.entries : archive;
    if (pool.length < 3) {
      json(res, 400, { ok: false, error: 'Zu wenige Stuecke im Bestand' });
      return;
    }

    const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(8, pool.length));
    let title = 'Ausstellung';
    let intro =
      'Sechs Stuecke aus dem Bestand, ausgewaehlt vom Kurator. Jedes davon war einmal wichtig, ' +
      'und fast keines davon haette ueberlebt.';

    if (mode === 'live') {
      try {
        const result = await askModel([
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content:
              'Du stellst eine kleine Ausstellung zusammen. Erfinde einen knappen Titel und eine ' +
              'Einleitung von zwei Saetzen. Antworte als JSON: {"title":"...","intro":"..."}.\n\n' +
              chosen.map((entry) => `- ${entry.title} (${entry.year || '?'}): ${entry.text}`).join('\n'),
          },
        ]);
        if (result.title) title = String(result.title).slice(0, 70);
        if (result.intro) intro = String(result.intro).slice(0, 400);
      } catch {
        /* Ohne Modell bleibt der Standardtext. */
      }
    }

    try {
      const result = publishExhibition({ title, intro, entries: chosen, push: body.push !== false });
      lastPublish = Date.now();
      journal(`Ich habe eine Ausstellung veroeffentlicht: ${title}.`, 'ausstellung');
      json(res, 200, { ok: true, ...result, title });
      return;
    } catch (error) {
      json(res, 500, { ok: false, error: error.message });
      return;
    }
  }

  if (path === '/brain/scan' && req.method === 'POST') {
    const entry = await scout.scan();
    json(res, 200, { found: Boolean(entry), entry });
    return;
  }

  /* --- W�nde ------------------------------------------------------------ */

  if (path === '/graffiti' && req.method === 'GET') {
    json(res, 200, graffiti);
    return;
  }

  if (path === '/graffiti' && req.method === 'POST') {
    const body = await readBody(req);
    const wall = String(body.wall || '').slice(0, 60);
    if (!wall) {
      json(res, 400, { error: 'wall fehlt' });
      return;
    }
    const target = wallEntry(wall);

    if (body.decal && Array.isArray(body.decal.p) && Array.isArray(body.decal.n)) {
      target.decal = {
        p: body.decal.p.map(Number),
        n: body.decal.n.map(Number),
        w: Number(body.decal.w) || 1.7,
        h: Number(body.decal.h) || 0.95,
      };
      await saveGraffiti();
      broadcast({ type: 'graffiti', wall, decal: target.decal });
      json(res, 200, { ok: true });
      return;
    }

    if (body.stroke && Array.isArray(body.stroke.points) && body.stroke.points.length > 1) {
      const stroke = {
        color: String(body.stroke.color || '#e8e2d0').slice(0, 20),
        width: Math.max(1, Math.min(14, Number(body.stroke.width) || 3)),
        points: body.stroke.points
          .slice(0, 400)
          .map((point) => [Number(point[0]) || 0, Number(point[1]) || 0]),
        at: Date.now(),
      };
      target.strokes.push(stroke);
      if (target.strokes.length > 400) target.strokes.shift();
      await saveGraffiti();
      broadcast({ type: 'graffiti', wall, stroke });
      json(res, 200, { ok: true });
      return;
    }

    if (body.note && body.note.text) {
      const note = {
        text: String(body.note.text).slice(0, 220),
        x: Math.max(0.04, Math.min(0.9, Number(body.note.x) || 0.2)),
        y: Math.max(0.08, Math.min(0.86, Number(body.note.y) || 0.3)),
        at: Date.now(),
      };
      target.notes.push(note);
      if (target.notes.length > 60) target.notes.shift();
      await saveGraffiti();
      broadcast({ type: 'graffiti', wall, note });
      json(res, 200, { ok: true });
      return;
    }

    json(res, 400, { error: 'leer' });
    return;
  }

  /* --- Statische Dateien ------------------------------------------------ */

  let filePath = decodeURIComponent(path);
  if (filePath.endsWith('/')) filePath += 'index.html';

  const target = normalize(join(root, filePath));
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  const info = await stat(target).catch(() => null);
  if (!info || !info.isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
    return;
  }

  const body = await readFile(target);
  res.writeHead(200, {
    'content-type': types[extname(target).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  }).end(body);
});

/* ------------------------------------------------------------------ Takt */

setInterval(() => {
  if (!clients.size) return;
  const now = Date.now();
  if (now - lastThoughtAt > (mode === 'live' ? 45000 : 26000)) {
    lastThoughtAt = now;
    think();
  }
  if (now - lastFindAt > 90000) {
    lastFindAt = now;
    // Nicht zu viele offene Vorschläge auf einmal.
    if ((session.pending || 0) >= 10) return;
    scout
      .scan()
      .then((found) => {
        if (!found) maybeFind();
      })
      .catch(() => maybeFind());
  }

  // Eigene Ausstellung, wenn ausdruecklich erlaubt.
  if (ENV.ARCHIV_PUBLISH === '1' && archive.length >= 6 && now - lastPublish > 4 * 3600 * 1000) {
    lastPublish = now;
    fetch(`http://127.0.0.1:${port}/brain/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries: archive, push: true }),
    }).catch(() => {});
  }
}, 5000);

// Besucher zählen, damit die Brücke nicht ins Leere denkt
setInterval(() => {
  if (clients.size) return;
  lastThoughtAt = Date.now();
}, 10000);

server.listen(port, () => {
  console.log('');
  console.log('  DAS ARCHIV �?" Brücke offen');
  console.log(`  http://localhost:${port}`);
  console.log(`  Verbindung: ${mode === 'live' ? `live (${provider.label} · ${provider.model})` : 'lokal (kein Schluessel gesetzt)'}`);
  console.log('');
}).on('error', (error) => {
  console.error(`Port ${port} belegt: ${error.message}`);
});

process.on('SIGINT', () => {
  for (const client of clients) client.end();
  process.exit(0);
});
