import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Das Gedächtnis des Kurators.
 *
 * Liegt auf dem Server, nicht im Browser. Es überlebt Neustarts und wird
 * bei jeder Anfrage mitgeschickt — im Live-Modus als Gesprächsverlauf,
 * im Lokal-Modus als Prüfung auf Wiederholungen.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const FILE = join(root, 'data', 'memory.json');
const MAX_TURNS = 80;

export function loadMemory() {
  if (!existsSync(FILE)) return { turns: [], since: Date.now() };
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    return {
      turns: Array.isArray(data.turns) ? data.turns.slice(-MAX_TURNS) : [],
      since: data.since || Date.now(),
    };
  } catch {
    return { turns: [], since: Date.now() };
  }
}

export function saveMemory(memory) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(memory));
  } catch {
    /* Ohne Speicher läuft das Gespräch trotzdem. */
  }
}

export function remember(memory, role, text) {
  const clean = String(text || '').trim().slice(0, 500);
  if (!clean) return;
  memory.turns.push({ role, text: clean, at: Date.now() });
  if (memory.turns.length > MAX_TURNS) memory.turns = memory.turns.slice(-MAX_TURNS);
  return memory;
}

export function recent(memory, count = 8) {
  return memory.turns.slice(-count);
}

export function transcript(memory, count = 8) {
  return recent(memory, count)
    .map((turn) => `${turn.role === 'user' ? 'Person' : 'Kurator'}: ${turn.text}`)
    .join('\n');
}

export function lastUserLine(memory) {
  for (let i = memory.turns.length - 1; i >= 0; i -= 1) {
    if (memory.turns[i].role === 'user') return memory.turns[i].text;
  }
  return '';
}

export function countTurns(memory) {
  return memory.turns.length;
}
