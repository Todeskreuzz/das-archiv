import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { reply as localReply, greeting as localGreeting, SUGGESTIONS } from '../src/ai/dialogue.js';
import { RESEARCH_POOL } from '../src/ai/research.js';

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

const API_KEY = process.env.ARCHIV_API_KEY || process.env.OPENAI_API_KEY || '';
const BASE_URL = (process.env.ARCHIV_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const MODEL = process.env.ARCHIV_MODEL || 'gpt-4o-mini';

const mode = API_KEY ? 'live' : 'local';

/* ------------------------------------------------------------------ Zustand */

const clients = new Set();
let session = {
  points: 0,
  total: 0,
  pending: 0,
  rank: 'Aushilfe',
  restored: 0,
  used: [],
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
{"say": "...", "thought": "...", "go": "galerie|spielhalle|bibliothek|tunnel|halle|null"}

"say" ist die Antwort an die Person. "thought" ist ein kurzer Gedanke (darf leer sein).
"go" ist ein Raum, in den du dich begeben willst, oder null.`;

function sessionLine() {
  return `Bestand: ${session.total} Stücke. Offen beim Gremium: ${session.pending}. Angesehen: ${session.restored}.`;
}

async function askModel(messages) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.85,
      max_tokens: 260,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Modell antwortet ${response.status}: ${text.slice(0, 160)}`);
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { say: raw.trim() };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { say: raw.trim() };
  }
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
        { role: 'user', content: `${sessionLine()}\n\nDenke laut, in einem Satz. Keine Antwort an jemanden, nur ein Gedanke.` },
      ]);
      const thought = String(result.thought || result.say || '').trim();
      if (thought) broadcast({ type: 'thought', text: thought });
      if (result.go) broadcast({ type: 'go', target: result.go });
      return;
    } catch (error) {
      broadcast({ type: 'notice', text: `Modell nicht erreichbar: ${error.message}` });
    }
  }

  broadcast({ type: 'thought', text: pickThought() });
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
  broadcast({ type: 'find', id: entry.id });
}

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
    json(res, 200, { mode, model: mode === 'live' ? MODEL : 'lokal', clients: clients.size });
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
    res.write(`data: ${JSON.stringify({ type: 'status', mode, model: mode === 'live' ? MODEL : 'lokal' })}\n\n`);
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
        const result = await askModel([
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `${sessionLine()}\n\nDie Person sagt: "${message}"\n\nAntworte als Kurator.`,
          },
        ]);
        if (result.go) broadcast({ type: 'go', target: result.go });
        if (result.thought) broadcast({ type: 'thought', text: result.thought });
        json(res, 200, { text: String(result.say || '�?�'), action: null });
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
    });
    json(res, 200, { text: answer.text, action: answer.action || null });
    return;
  }

  if (path === '/brain/suggestions') {
    json(res, 200, { suggestions: SUGGESTIONS });
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
  if (now - lastFindAt > 110000) {
    lastFindAt = now;
    maybeFind();
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
  console.log(`  Verbindung: ${mode === 'live' ? `live (${MODEL})` : 'lokal (kein Schlüssel gesetzt)'}`);
  console.log('');
}).on('error', (error) => {
  console.error(`Port ${port} belegt: ${error.message}`);
});

process.on('SIGINT', () => {
  for (const client of clients) client.end();
  process.exit(0);
});
