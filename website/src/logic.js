/**
 * Reine Spiellogik — kein DOM, kein localStorage.
 *
 * Es gibt keine Punkte und keine Ränge. Ein Archiv belohnt nichts,
 * es bewahrt auf. Was bleibt, ist die Frage: kommt ein Stück ins Haus?
 */

export const HALL = { quorum: 5 };

/** Kuratorstimme zählt doppelt — er hat Hausrecht. */
export function tally(candidate, votes) {
  const yes = (candidate.seedYes || 0) + Object.values(votes).filter((value) => value === 1).length;
  const no = (candidate.seedNo || 0) + Object.values(votes).filter((value) => value === -1).length;
  const curator = (candidate.curatorVote || 0) * 2;
  const net = yes - no + curator;
  return { yes, no, curator, net, quorum: HALL.quorum, passed: net >= HALL.quorum };
}

export function verdictOf(candidate, votes) {
  const result = tally(candidate, votes);
  if (result.passed) return { ...result, verdict: 'aufnehmen' };
  if (result.net < 0) return { ...result, verdict: 'ablehnen' };
  return { ...result, verdict: 'offen' };
}

export function eraOf(year) {
  if (!year) return 'Unbekannt';
  if (year < 1993) return 'Vor dem Web';
  if (year < 2000) return '1990er';
  if (year < 2010) return '2000er';
  return '2010er';
}

export function searchEntries(entries, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return entries;
  const terms = q.split(/\s+/);
  return entries.filter((entry) => {
    const haystack = [entry.title, entry.host, entry.kind, entry.text, (entry.tags || []).join(' '), String(entry.year)]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Wie viel vom Bestand wurde angesehen? */
export function securedCount(state, entries) {
  return entries.filter((entry) => state.restored[entry.id]).length;
}
