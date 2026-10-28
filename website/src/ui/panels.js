import { esc, pad } from '../util.js';
import { poster, curatorSigil } from '../data/art.js';
import { state, pendingCandidates, liveEntries, votesOf } from '../state.js';
import { tally, eraOf } from '../logic.js';
import { explainCandidate, briefing, signature } from '../curator.js';
import { CURATOR } from '../data/seed.js';
import { propData } from '../data/props.js';

const RARITY_LABEL = { einzigartig: 'Einzelstück', selten: 'Selten', verbreitet: 'Bestand' };
const ROOM_LABEL = { galerie: 'Galerie', spielhalle: 'Spielhalle', bibliothek: 'Bibliothek' };

function sheet({ kicker, title, body, foot, left = false }) {
  return `
  <div class="sheet">
    <header class="sheet__head${left ? ' sheet__head--left' : ''}">
      ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
      <h2>${esc(title)}</h2>
    </header>
    <div class="sheet__body">${body}</div>
    <footer class="sheet__foot">${foot || '<button class="btn-line" data-close>Zurück · ESC</button>'}</footer>
  </div>`;
}

/* ------------------------------------------------------------------ Exponat */

export function exhibitPanel(entry) {
  const saved = Boolean(state.restored[entry.id]);
  const isCandidate = entry.curatorVote !== undefined && !state.resolved[entry.id] && !saved;
  const result = tally(entry, votesOf(entry.id));
  const myVote = state.votes[entry.id] || 0;

  const body = `
    <article class="exhibit">
      <div class="exhibit__art">
        <div class="poster">${poster(entry)}</div>
        <div class="exhibit__stamp">
          <span>${esc(RARITY_LABEL[entry.rarity] || 'Bestand')}</span>
          <span>${esc(String(entry.year || '—'))}</span>
        </div>
      </div>

      <div class="exhibit__body">
        <div class="exhibit__kicker">
          <span class="chip chip--amber">${esc(entry.kind)}</span>
          <span class="chip">${esc(eraOf(entry.year))}</span>
          <span class="chip">${esc(ROOM_LABEL[entry.room] || 'Depot')}</span>
          ${saved ? '<span class="chip chip--green">gesichert</span>' : '<span class="chip">unberührt</span>'}
        </div>

        <h3 class="exhibit__title">${esc(entry.title)}</h3>
        <p class="exhibit__host">${entry.url ? `<a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.host)}</a>` : esc(entry.host)}</p>

        <div class="curator-note">
          ${esc(entry.text)}
          <small>${esc(signature(entry.id))}</small>
        </div>

        <dl class="facts">
          <div><dt>Jahr</dt><dd>${esc(String(entry.year || '—'))}</dd></div>
          <div><dt>Gattung</dt><dd>${esc(entry.kind)}</dd></div>
          <div><dt>Status</dt><dd>${saved ? 'gesichert' : 'offen'}</dd></div>
          <div><dt>Signatur</dt><dd>${esc(entry.id.slice(0, 12).toUpperCase())}</dd></div>
        </dl>

        ${entry.note ? `<p class="exhibit__note"><span class="eyebrow">Randnotiz</span>${esc(entry.note)}</p>` : ''}

        <div class="tags">${(entry.tags || []).map((tag) => `<span class="chip">${esc(tag)}</span>`).join('')}</div>

        <div class="exhibit__actions">
          ${
            saved
              ? `<span class="done-badge">✓ im Bestand gesichert</span>
                 <button class="btn-line" data-close>Zurück in den Raum</button>`
              : `<button class="btn-solid" data-restore="${entry.id}">Sichern</button>
                 <button class="btn-line" data-close>Zurück</button>`
          }
        </div>

        ${
          isCandidate
            ? `<div class="mini-vote">
                <div class="mini-vote__head">
                  <span class="kicker">Das Gremium entscheidet</span>
                  <span class="chip ${entry.curatorVote > 0 ? 'chip--green' : entry.curatorVote < 0 ? 'chip--red' : 'chip--amber'}">
                    Kurator ${entry.curatorVote > 0 ? '+' : ''}${entry.curatorVote * 2}
                  </span>
                </div>
                <p class="mini-vote__curator">${esc(explainCandidate(entry))}</p>
                <div class="mini-vote__row">
                  <button class="vote vote--yes${myVote === 1 ? ' is-on' : ''}" data-vote="${entry.id}" data-dir="1">
                    <span>Dafür</span><b>${result.yes}</b>
                  </button>
                  <button class="vote vote--no${myVote === -1 ? ' is-on' : ''}" data-vote="${entry.id}" data-dir="-1">
                    <span>Dagegen</span><b>${result.no}</b>
                  </button>
                  <span class="mini-vote__net">Netto ${result.net >= 0 ? '+' : ''}${result.net} / ${result.quorum}</span>
                </div>
              </div>`
            : ''
        }
      </div>
    </article>`;

  return sheet({ kicker: `Signatur ${entry.id.toUpperCase().slice(0, 18)}`, title: 'Exponat', body });
}

/* ------------------------------------------------------------------ Kurator */

export function curatorPanel() {
  const archive = liveEntries();
  const pending = pendingCandidates();
  const secured = archive.filter((entry) => state.restored[entry.id]).length;

  const body = `
    <p class="talk__lead">${esc(briefing(state, archive))}</p>
    <p class="talk__self">${esc(CURATOR.self)}</p>

    <div class="talk__grid">
      <div class="talk__stat">
        <span>Bestand</span>
        <b>${pad(archive.length, 2)}</b>
        <span>Stücke im Haus</span>
      </div>
      <div class="talk__stat">
        <span>Gremium</span>
        <b>${pad(pending.length, 2)}</b>
        <span>offene Vorschläge</span>
      </div>
      <div class="talk__stat">
        <span>Angesehen</span>
        <b>${pad(secured, 2)}</b>
        <span>von ${archive.length}</span>
      </div>
    </div>

    <p class="talk__hint">Ich entscheide nicht allein. Am GREMIUM-Terminal stimmt das Gremium ab — meine Stimme zählt doppelt.</p>`;

  return sheet({
    kicker: `${CURATOR.name} · ${CURATOR.revision}`,
    title: 'Der Kurator',
    body,
    foot: `
      <button class="btn-solid" data-open-chat>Reden</button>
      <button class="btn-line" data-open-ballot>Zum Gremium</button>
      <button class="btn-line" data-open-submit>Nominieren</button>
      <button class="btn-line" data-close>Weitergehen</button>`,
  });
}

/* ---------------------------------------------------------------- Abstimmung */

export function ballotPanel() {
  const candidates = pendingCandidates();
  const body = `
    <p class="ballot__lead">Jede Stimme zählt einfach, meine doppelt. Das ist nicht fair, aber ich führe das Haus.
    Quorum: ${tally({}, {}).quorum} Netto-Stimmen.</p>
    ${
      candidates.length
        ? `<div class="ballot__list">${candidates.map(candidateRow).join('')}</div>`
        : '<p class="ballot__lead">Keine offenen Kandidaten. Reiche etwas ein — ich prüfe es sofort.</p>'
    }`;

  return sheet({
    kicker: 'Das Gremium · Foyer',
    title: 'Was kommt ins Haus?',
    body,
    foot: `
      <button class="btn-line" data-open-submit>Nominieren</button>
      <button class="btn-line" data-close>Zurück · ESC</button>`,
  });
}

function candidateRow(candidate) {
  const result = tally(candidate, votesOf(candidate.id));
  const myVote = state.votes[candidate.id] || 0;
  const ratio = Math.max(0, Math.min(1, (result.net + 6) / 12));

  return `
  <article class="cand">
    <div class="cand__art">${poster(candidate, { compact: true })}</div>
    <div class="cand__body">
      <div class="cand__top">
        <h3>${esc(candidate.title)}</h3>
        <span class="chip">${esc(String(candidate.year))}</span>
      </div>
      <p class="cand__host">${esc(candidate.host)} · ${esc(candidate.kind)}</p>
      <p class="cand__text">${esc(candidate.text)}</p>
      <p class="cand__curator"><span>${esc(explainCandidate(candidate))}</span></p>
      <div class="cand__bar"><i style="width:${(ratio * 100).toFixed(1)}%"></i></div>
      <div class="cand__foot">
        <div class="votes">
          <button class="vote vote--yes${myVote === 1 ? ' is-on' : ''}" data-vote="${candidate.id}" data-dir="1">
            <span>Dafür</span><b>${result.yes}</b>
          </button>
          <button class="vote vote--no${myVote === -1 ? ' is-on' : ''}" data-vote="${candidate.id}" data-dir="-1">
            <span>Dagegen</span><b>${result.no}</b>
          </button>
        </div>
        <span class="chip ${candidate.curatorVote > 0 ? 'chip--green' : candidate.curatorVote < 0 ? 'chip--red' : 'chip--amber'}">
          Kurator ${candidate.curatorVote > 0 ? '+' : ''}${candidate.curatorVote * 2}
        </span>
      </div>
      <p class="cand__net">Netto ${result.net >= 0 ? '+' : ''}${result.net} · es fehlen ${Math.max(0, result.quorum - result.net)}</p>
    </div>
  </article>`;
}

/* --------------------------------------------------------------- Nominieren */

export function submitPanel() {
  const body = `
    <p class="ballot__lead">
      Der Kurator nimmt jeden Vorschlag persönlich an. Er prüft, bewertet und sagt dir, was er davon hält —
      auch wenn es dir nicht gefällt. Über die Aufnahme entscheidet danach das Gremium.
    </p>

    <form id="submit-form" class="form" autocomplete="off">
      <label class="field">
        <span>Was hast du gefunden?</span>
        <input name="title" type="text" maxlength="80" required placeholder="z. B. Das Gästebuch von …">
      </label>
      <label class="field">
        <span>Adresse</span>
        <input name="url" type="text" inputmode="url" maxlength="200" placeholder="beispiel.de oder https://…">
      </label>
      <label class="field">
        <span>Warum gehört es ins Archiv?</span>
        <textarea name="note" rows="3" maxlength="400" placeholder="Ein Satz reicht. Jahreszahl hilft."></textarea>
      </label>
      <button class="btn-solid btn-line--wide" type="submit">Dem Kurator vorlegen</button>
      <p class="form__note">Der Kurator antwortet sofort. Kein Konto nötig.</p>
    </form>

    <div id="judgment" class="judgment" hidden></div>`;

  return sheet({
    kicker: 'Foyer · Einreichung',
    title: 'Nominieren',
    body,
    foot: '<button class="btn-line" data-close>Zurück · ESC</button>',
  });
}

export function judgmentPanel(verdict, entry = {}) {
  const tone =
    verdict.verdict === 'aufnehmen' ? 'chip--green' : verdict.verdict === 'ablehnen' ? 'chip--red' : 'chip--amber';
  return `
    <div class="judgment__head">
      <span class="chip ${tone}">${verdict.verdict === 'aufnehmen' ? 'Aufnehmen' : verdict.verdict === 'ablehnen' ? 'Ablehnen' : 'Prüfen'}</span>
      <div class="judgment__score"><b>${pad(verdict.score)}</b><span>/100</span></div>
    </div>
    <p class="judgment__title">${esc(entry.title || 'Dein Fund')}</p>
    <ul class="judgment__reasons">${verdict.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}</ul>
    <p class="judgment__draft">${esc(verdict.text)}</p>
    <p class="judgment__foot">
      ${curatorSigil(12)}
      <span>${verdict.verdict === 'ablehnen' ? 'Abgelehnt — der Vorgang bleibt einsehbar.' : 'Der Vorschlag liegt jetzt beim Gremium.'}</span>
    </p>`;
}

/* --------------------------------------------------------------- Übersichten */

export function allPanel() {
  const rooms = ['galerie', 'spielhalle', 'bibliothek'];
  const body = rooms
    .map((room) => {
      const entries = liveEntries().filter((entry) => entry.room === room);
      return `
        <p class="kicker" style="margin:18px 0 6px">${esc(ROOM_LABEL[room])} · ${pad(entries.length, 2)}</p>
        <div class="rows">
          ${entries
            .map(
              (entry) => `
            <div>
              <button class="row__label linkish" data-entry="${entry.id}">${esc(entry.title)}</button>
              <span class="row__value">
                ${state.restored[entry.id] ? '<span class="chip chip--green">gesichert</span>' : ''}
                ${esc(String(entry.year || '—'))}
              </span>
            </div>`,
            )
            .join('')}
        </div>`;
    })
    .join('');

  return sheet({ kicker: 'Bestand', title: 'Alles', body, foot: '<button class="btn-line" data-close>Zurück · ESC</button>' });
}

export function logPanel() {
  const body = state.log.length
    ? `<div class="rows">${state.log
        .slice(0, 40)
        .map(
          (line) => `
        <div>
          <span class="row__value" style="min-width:44px">${new Date(line.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="row__label">${esc(line.text)}</span>
        </div>`,
        )
        .join('')}</div>`
    : '<p class="ballot__lead">Noch nichts passiert. Das ändert sich schnell.</p>';

  return sheet({ kicker: 'Kuratorium', title: 'Protokoll', body, foot: '<button class="btn-line" data-close>Zurück · ESC</button>' });
}

export function aboutPanel() {
  const body = `
    <p class="ballot__lead">
      Das Archiv sammelt deutsche Internetgeschichte: Grafiken, Browserspiele, Portale, Weblogs,
      Communities und die Vorläufer vor dem Web.
    </p>
    <div class="rows">
      <div><span class="row__label">Galerie</span><span class="row__value">Saal I · Westen</span></div>
      <div><span class="row__label">Spielhalle</span><span class="row__value">Saal II · Osten</span></div>
      <div><span class="row__label">Bibliothek</span><span class="row__value">Saal III · Norden</span></div>
      <div><span class="row__label">Foyer</span><span class="row__value">Terminals &amp; Gremium</span></div>
    </div>
    <p class="ballot__lead" style="margin-top:18px">
      Jedes Exponat ist ein echtes Phänomen. Die Texte sind eigene Formulierungen, keine kopierten Artikel.
      Jahreszahlen sind gerundet; wo etwas umstritten ist, steht es dabei.
    </p>
    <p class="talk__hint">Kein Zeitlimit. Das hier ist ein Langzeitprojekt.</p>`;

  return sheet({ kicker: 'Über', title: 'Das Haus', body, foot: '<button class="btn-line" data-close>Zurück · ESC</button>' });
}

export function anonPanel() {
  const body = `
    <p class="ballot__lead">
      Du brauchst kein Konto. Es gibt keine Anmeldung, keine E-Mail, keinen Server, der mitschreibt.
    </p>
    <div class="rows">
      <div><span class="row__label">Speicherort</span><span class="row__value">dein Browser</span></div>
      <div><span class="row__label">Schlüssel</span><span class="row__value">das-archiv.v1</span></div>
      <div><span class="row__label">Übertragung</span><span class="row__value">keine</span></div>
      <div><span class="row__label">Tracking</span><span class="row__value">keines</span></div>
    </div>
    <p class="ballot__lead" style="margin-top:18px">
      Deine Stimmen und Funde bleiben auf diesem Gerät. Wenn du den Browser-Speicher löschst,
      sind sie weg — wie ein Zettel im Papierkorb.
    </p>`;

  return sheet({ kicker: 'Anonymität', title: 'Deine Spuren', body, foot: '<button class="btn-line" data-close>Zurück · ESC</button>' });
}

/* --------------------------------------------------------------- Objekte */

export function propPanel(id) {
  const prop = propData(id);
  const body = `
    <p class="ballot__lead">${esc(prop.text)}</p>
    <div class="rows">
      <div><span class="row__label">Zustand</span><span class="row__value">im Haus</span></div>
      <div><span class="row__label">Anfassbar</span><span class="row__value">ja</span></div>
    </div>`;

  return sheet({
    kicker: 'Objekt',
    title: prop.title,
    body,
    foot: '<button class="btn-line" data-close>Zurück · ESC</button>',
  });
}

export function accountPanel() {
  const secured = liveEntries().filter((entry) => state.restored[entry.id]).length;
  const body = `
    <div class="rows">
      <div><span class="row__label">Angesehen</span><span class="row__value">${pad(secured, 2)} Stücke</span></div>
      <div><span class="row__label">Eingereicht</span><span class="row__value">${pad(state.submissions.length, 2)}</span></div>
      <div><span class="row__label">Stimmen</span><span class="row__value">${pad(Object.keys(state.votes).length, 2)}</span></div>
    </div>

    <p class="ballot__lead" style="margin-top:18px">
      Du kannst alles löschen. Der Bestand des Hauses bleibt, aber deine Spuren verschwinden.
    </p>

    <button class="btn-line" data-reset style="border-color:#ff5a4a66;color:#ff5a4a">
      Eigenen Stand zurücksetzen
    </button>`;

  return sheet({ kicker: 'Konto', title: 'Ohne Passwort', body, foot: '<button class="btn-line" data-close>Zurück · ESC</button>' });
}

/* Ende der Panels. */