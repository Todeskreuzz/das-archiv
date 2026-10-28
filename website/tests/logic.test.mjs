import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tally, verdictOf, eraOf, searchEntries, securedCount, HALL } from '../src/logic.js';
import { judge, explainCandidate, voteSpeech } from '../src/curator.js';
import { reply, greeting } from '../src/ai/dialogue.js';
import { ARCHIVE, CANDIDATES, EXHIBITS } from '../src/data/seed.js';

/* ---------------------------------------------------------------- Abstimmung */

test('Kuratorstimme zählt doppelt', () => {
  assert.equal(tally({ curatorVote: 1, seedYes: 0, seedNo: 0 }, {}).net, 2);
  assert.equal(tally({ curatorVote: -2, seedYes: 0, seedNo: 0 }, {}).net, -4);
});

test('Quorum entscheidet über Aufnahme', () => {
  const candidate = { curatorVote: 0, seedYes: 0, seedNo: 0 };
  const votes = { a: 1, b: 1, c: 1, d: 1, e: 1 };
  const result = tally(candidate, votes);
  assert.equal(result.net, HALL.quorum);
  assert.equal(result.passed, true);
  assert.equal(verdictOf(candidate, votes).verdict, 'aufnehmen');
});

test('Gegenstimmen senken das Netto', () => {
  const candidate = { curatorVote: 0, seedYes: 0, seedNo: 0 };
  const votes = { a: 1, b: 1, c: -1, d: -1, e: -1 };
  assert.equal(tally(candidate, votes).net, -1);
  assert.equal(tally(candidate, votes).passed, false);
  assert.equal(verdictOf(candidate, votes).verdict, 'ablehnen');
});

test('Startstimmen zählen mit', () => {
  const candidate = { curatorVote: 1, seedYes: 3, seedNo: 1 };
  const result = tally(candidate, {});
  assert.equal(result.yes, 3);
  assert.equal(result.no, 1);
  assert.equal(result.net, 4);
  assert.equal(result.passed, false);
});

/* ------------------------------------------------------------------ Suche */

test('Suche findet Titel, Host und Tags', () => {
  assert.equal(searchEntries(ARCHIVE, 'moorhuhn')[0].id, 'moorhuhn');
  assert.ok(searchEntries(ARCHIVE, 'fefe.de').some((entry) => entry.id === 'fefes-blog'));
  assert.equal(searchEntries(ARCHIVE, '').length, ARCHIVE.length);
  assert.equal(searchEntries(ARCHIVE, 'gibtesnicht').length, 0);
});

test('Suche verknüpft mehrere Begriffe', () => {
  const result = searchEntries(ARCHIVE, 'studivz community');
  assert.ok(result.length >= 1);
  assert.ok(result.every((entry) => entry.id !== 'moorhuhn'));
});

/* --------------------------------------------------------------- Zeitraum */

test('Epochen werden benannt', () => {
  assert.equal(eraOf(1983), 'Vor dem Web');
  assert.equal(eraOf(1994), '1990er');
  assert.equal(eraOf(2003), '2000er');
  assert.equal(eraOf(2010), '2010er');
  assert.equal(eraOf(null), 'Unbekannt');
});

/* --------------------------------------------------------------- Bestand */

test('Angesehene Stücke werden gezählt', () => {
  const state = { restored: { moorhuhn: 1, studivz: 2 } };
  assert.equal(securedCount(state, ARCHIVE), 2);
  assert.equal(securedCount({ restored: {} }, ARCHIVE), 0);
});

/* ------------------------------------------------------------------ Kurator */

test('Kurator nimmt ein plausibles deutsches Fundstück auf', () => {
  const verdict = judge(
    {
      title: 'Das Gästebuch von Hannover',
      url: 'https://gaestebuch-hannover.de',
      note: 'Ein Forum aus dem Jahr 1999, in dem sich die halbe Stadt traf.',
    },
    ARCHIVE,
  );
  assert.ok(verdict.score >= 68, `Score war ${verdict.score}`);
  assert.equal(verdict.verdict, 'aufnehmen');
  assert.ok(verdict.reasons.length > 0);
});

test('Kurator lehnt Werbung ab', () => {
  const verdict = judge(
    { title: 'Casino Gewinnspiel', url: 'https://casino-test.de', note: 'Jetzt Kredit sichern' },
    ARCHIVE,
  );
  assert.equal(verdict.verdict, 'ablehnen');
  assert.ok(verdict.score < 38);
});

test('Kurator erkennt Doppelungen', () => {
  const verdict = judge({ title: 'Nochmal Fefe', url: 'https://fefe.de' }, ARCHIVE);
  assert.ok(verdict.reasons.some((reason) => reason.includes('bereits im Bestand')));
  assert.notEqual(verdict.verdict, 'aufnehmen');
});

test('Kurator verlangt einen Titel', () => {
  assert.equal(judge({ title: '', url: 'https://test.de' }, ARCHIVE).verdict, 'ablehnen');
});

test('Kurator äußert sich zu jedem Kandidaten', () => {
  for (const candidate of CANDIDATES) {
    assert.ok(explainCandidate(candidate).includes(candidate.title));
    assert.ok(voteSpeech(candidate, {}).includes(candidate.title));
  }
});

/* ------------------------------------------------------------------ Gespräch */

const ctx = {
  state: { restored: {} },
  entries: ARCHIVE,
  pending: [],
  total: ARCHIVE.length,
  secured: 0,
};

test('Begrüßung ist ein ganzer Satz', () => {
  const text = greeting(ctx);
  assert.ok(text.length > 40);
  assert.ok(text.includes('.'));
});

test('Frage nach einem Stück gibt dessen Text zurück', () => {
  const answer = reply('Was weißt du über Moorhuhn?', ctx);
  assert.ok(answer.text.includes('Moorhuhn'));
  assert.equal(answer.action, 'open:moorhuhn');
});

test('Empfehlung nennt ein Stück und öffnet es', () => {
  const answer = reply('Was soll ich ansehen?', ctx);
  assert.ok(answer.text.length > 20);
  assert.ok(answer.action?.startsWith('open:'));
});

test('Suche löst eine Aktion aus', () => {
  assert.equal(reply('Suche etwas Neues', ctx).action, 'find');
});

test('Unbekanntes wird eingeräumt, nicht erfunden', () => {
  const answer = reply('Wie funktioniert ein Kernkraftwerk?', ctx);
  assert.ok(answer.text.length > 20);
  assert.equal(answer.action, undefined);
});

/* --------------------------------------------------------------- Bestand */

test('Bestand ist konsistent', () => {
  const ids = new Set();
  for (const entry of EXHIBITS) {
    assert.ok(entry.id, 'id fehlt');
    assert.ok(!ids.has(entry.id), `doppelte id: ${entry.id}`);
    ids.add(entry.id);
    for (const field of ['title', 'kind', 'rarity', 'text', 'host']) {
      assert.ok(entry[field], `${entry.id}: ${field} fehlt`);
    }
    assert.ok(['galerie', 'spielhalle', 'bibliothek'].includes(entry.room), `${entry.id}: Raum`);
    assert.ok(['einzigartig', 'selten', 'verbreitet'].includes(entry.rarity), `${entry.id}: Seltenheit`);
  }
});

test('Jeder Saal ist gefüllt', () => {
  for (const room of ['galerie', 'spielhalle', 'bibliothek']) {
    assert.ok(ARCHIVE.filter((entry) => entry.room === room).length >= 5, `${room} ist zu leer`);
  }
});
