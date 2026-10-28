/**
 * Zustand + Speicherung.
 * Alles, was der Besuch verändert, liegt in localStorage.
 */
import { ARCHIVE, CANDIDATES, EXHIBITS } from './data/seed.js';
import { tally } from './logic.js';
import { judge, react } from './curator.js';
import { dayKey, uid } from './util.js';

const KEY = 'das-archiv.v2';
const listeners = new Set();

function freshState() {
  return {
    v: 2,
    restored: {},
    votes: {},
    submissions: [],
    resolved: {},
    log: [],
    seenIntro: true,
    muted: false,
  };
}

function load() {
  const read = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saved = read(KEY) || read('das-archiv.v1');
  if (!saved) return freshState();

  return {
    ...freshState(),
    restored: saved.restored || {},
    votes: saved.votes || {},
    submissions: saved.submissions || [],
    resolved: saved.resolved || {},
    log: saved.log || [],
    muted: Boolean(saved.muted),
  };
}

export const state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Speicher voll oder gesperrt — das Haus läuft weiter. */
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  persist();
  for (const fn of listeners) fn(state, event);
}

/* ---------------------------------------------------------------- Ableitungen */

export function acceptedEntries() {
  const fromSeed = CANDIDATES.filter((candidate) => state.resolved[candidate.id] === 'accepted');
  const fromUser = state.submissions.filter((entry) => entry.status === 'accepted');
  return [...fromSeed, ...fromUser];
}

export function liveEntries() {
  return [...ARCHIVE, ...acceptedEntries()];
}

export function entryById(id) {
  return [...EXHIBITS, ...state.submissions].find((entry) => entry.id === id);
}

export function pendingCandidates() {
  const seeds = CANDIDATES.filter((candidate) => !state.resolved[candidate.id]);
  const mine = state.submissions.filter((entry) => entry.status === 'pending');
  return [...seeds, ...mine];
}

export function isRestored(id) {
  return Boolean(state.restored[id]);
}

export function securedCount() {
  return liveEntries().filter((entry) => state.restored[entry.id]).length;
}

/* ---------------------------------------------------------------- Aktionen */

export function addLog(kind, text) {
  state.log.unshift({ at: Date.now(), kind, text });
  state.log = state.log.slice(0, 60);
}

/** Ein Stück ansehen und als gesichert vermerken. Ohne Belohnung. */
export function restore(entry) {
  if (state.restored[entry.id]) return { ok: false, reason: 'bereits' };
  state.restored[entry.id] = Date.now();
  const line = react('restore', { id: entry.id }, String(Object.keys(state.restored).length));
  addLog('restore', `${entry.title} gesichert. ${line}`);
  emit({ type: 'restore', entry });
  return { ok: true, line };
}

export function castVote(candidateId, direction) {
  const candidate = entryById(candidateId);
  if (!candidate) return { ok: false };
  const previous = state.votes[candidateId];

  if (previous === direction) delete state.votes[candidateId];
  else state.votes[candidateId] = direction;

  const votes = state.votes[candidateId] === undefined ? {} : { own: state.votes[candidateId] };
  const result = tally(candidate, votes);
  let resolution = null;

  if (result.passed && !state.resolved[candidateId]) {
    state.resolved[candidateId] = 'accepted';
    const mine = state.submissions.find((entry) => entry.id === candidateId);
    if (mine) mine.status = 'accepted';
    resolution = 'accepted';
    addLog('accepted', `${candidate.title} wurde aufgenommen. ${react('accepted', { id: candidateId }, candidateId)}`);
  }

  const line = react('vote', { id: candidateId }, candidateId + String(Object.keys(state.votes).length));
  emit({ type: 'vote', candidate, direction, resolution, line });
  return { ok: true, result, resolution, line };
}

export function votesOf(candidateId) {
  return state.votes[candidateId] === undefined ? {} : { own: state.votes[candidateId] };
}

export function submit(input) {
  const verdict = judge(input, liveEntries());
  const entry = {
    id: `fund-${uid('x')}`,
    room: verdict.kind === 'Browserspiel' ? 'spielhalle' : verdict.kind === 'Grafik' ? 'galerie' : 'bibliothek',
    title: String(input.title || '').trim(),
    host: verdict.host || '—',
    url: String(input.url || '').trim(),
    year: Number((String(input.note || '').match(/\b(19[5-9]\d|20[0-2]\d)\b/) || [])[1]) || null,
    kind: verdict.kind,
    rarity: verdict.rarity,
    accent: '#6ee7d7',
    motif: 'eye',
    tags: ['Eingereicht'],
    text: verdict.text,
    note: String(input.note || '').trim() || 'Ohne weitere Angaben eingereicht.',
    curatorVote: verdict.verdict === 'aufnehmen' ? 1 : verdict.verdict === 'ablehnen' ? -2 : 0,
    seedYes: 0,
    seedNo: 0,
    status: verdict.verdict === 'ablehnen' ? 'rejected' : 'pending',
    judgment: verdict,
    submittedAt: Date.now(),
  };

  state.submissions.unshift(entry);
  if (verdict.verdict === 'ablehnen') state.resolved[entry.id] = 'rejected';
  addLog('submit', `Einreichung geprüft: ${entry.title || 'ohne Titel'} — ${verdict.score}/100, Urteil: ${verdict.verdict}.`);

  emit({ type: 'submit', entry, verdict });
  return { entry, verdict };
}

/** Der Kurator legt selbst einen Fund vor. */
export function addCuratorFind(entry) {
  const exists = [...EXHIBITS, ...state.submissions].some((item) => item.id === entry.id);
  if (exists) return null;
  const candidate = { ...entry, status: 'pending', submittedAt: Date.now(), source: 'curator' };
  state.submissions.unshift(candidate);
  addLog('find', `Eigener Fund: ${entry.title}. Liegt beim Gremium.`);
  emit({ type: 'find', entry: candidate });
  return candidate;
}

export function toggleMute() {
  state.muted = !state.muted;
  emit({ type: 'mute' });
  return state.muted;
}

export function markSeen() {
  state.seenIntro = true;
  emit({ type: 'seen' });
}

export function resetAll() {
  Object.assign(state, freshState());
  emit({ type: 'reset' });
}

export { dayKey };
