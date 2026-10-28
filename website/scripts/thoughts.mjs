import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Das Gedankenbuch des Kurators.
 *
 * Jeder Gedanke, den er laut denkt oder beim Suchen hat, wird hier festgehalten.
 * Die Besucherin kann das lesen und die Welt danach gestalten.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const FILE = join(root, 'data', 'thoughts.json');
const MAX = 500;

export function loadThoughts() {
  if (!existsSync(FILE)) return { items: [] };
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8'));
    return { items: Array.isArray(data.items) ? data.items.slice(-MAX) : [] };
  } catch {
    return { items: [] };
  }
}

export function addThought(book, text, kind = 'gedanke') {
  const clean = String(text || '').trim().slice(0, 600);
  if (!clean) return book;
  book.items.push({ at: Date.now(), kind, text: clean });
  if (book.items.length > MAX) book.items = book.items.slice(-MAX);
  return book;
}

export function saveThoughts(book) {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(book));
  } catch {
    /* Ohne Speicher bleibt der Gedanke in der Sitzung. */
  }
}

export function recentThoughts(book, count = 80) {
  return book.items.slice(-count).reverse();
}

export function thoughtsForPrompt(book, count = 6) {
  return book.items
    .slice(-count)
    .map((item) => `- ${item.text}`)
    .join('\n');
}
