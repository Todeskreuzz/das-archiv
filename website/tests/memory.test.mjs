import { test } from 'node:test';
import assert from 'node:assert/strict';

import { remember, recent, transcript, lastUserLine, countTurns } from '../scripts/memory.mjs';

test('remember hängt Turns an und zählt sie', () => {
  const memory = { turns: [], since: Date.now() };
  remember(memory, 'user', 'Hallo');
  remember(memory, 'curator', 'Guten Tag');
  assert.equal(countTurns(memory), 2);
  assert.equal(memory.turns[0].role, 'user');
  assert.equal(memory.turns[1].text, 'Guten Tag');
});

test('remember verwirft leere Texte', () => {
  const memory = { turns: [], since: Date.now() };
  remember(memory, 'user', '   ');
  remember(memory, 'user', '');
  assert.equal(countTurns(memory), 0);
});

test('remember begrenzt den Verlauf', () => {
  const memory = { turns: [], since: Date.now() };
  for (let i = 0; i < 120; i += 1) remember(memory, 'user', `Frage ${i}`);
  assert.equal(countTurns(memory), 80);
  assert.equal(memory.turns.at(-1).text, 'Frage 119');
});

test('recent liefert die letzten Einträge in Reihenfolge', () => {
  const memory = { turns: [], since: Date.now() };
  for (let i = 0; i < 10; i += 1) remember(memory, 'user', `F${i}`);
  const last = recent(memory, 3);
  assert.deepEqual(
    last.map((turn) => turn.text),
    ['F7', 'F8', 'F9'],
  );
});

test('transcript beschriftet die Rollen', () => {
  const memory = { turns: [], since: Date.now() };
  remember(memory, 'user', 'Hallo');
  remember(memory, 'curator', 'Guten Tag');
  const text = transcript(memory, 2);
  assert.ok(text.includes('Person: Hallo'));
  assert.ok(text.includes('Kurator: Guten Tag'));
});

test('lastUserLine findet die letzte Frage', () => {
  const memory = { turns: [], since: Date.now() };
  remember(memory, 'user', 'Erste Frage');
  remember(memory, 'curator', 'Antwort');
  remember(memory, 'user', 'Zweite Frage');
  assert.equal(lastUserLine(memory), 'Zweite Frage');
});
