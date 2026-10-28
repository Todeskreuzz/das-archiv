import { esc } from '../util.js';
import { state, liveEntries, pendingCandidates } from '../state.js';

const ITEMS = [
  { id: 'alles', label: 'Alles', hint: () => `${liveEntries().length} Exponate` },
  { id: 'ballot', label: 'Zur Abstimmung', hint: () => `${pendingCandidates().length} offen` },
  { id: 'submit', label: 'Nominieren', hint: () => 'Fund vorlegen' },
  { id: 'log', label: 'Protokoll', hint: () => `${state.log.length} Einträge` },
  { id: 'about', label: 'Über das Archiv', hint: () => 'Haus & Regeln' },
  { id: 'anon', label: 'Anonymität', hint: () => 'deine Spuren' },
  { id: 'account', label: 'Dein Konto', hint: () => 'lokal, ohne Passwort' },
];

export function createMenu() {
  const root = document.querySelector('#menu');
  let mode = 'start';
  let actionHandler = null;
  let open = false;

  function render() {
    const entries = liveEntries();
    const secured = entries.filter((entry) => state.restored[entry.id]).length;

    root.innerHTML = `
      <div class="menu__panel">
        <p class="menu__kicker">Deutsches Internet-Museum · seit 1994</p>
        <h1 class="menu__title">DAS ARCHIV</h1>
        <p class="menu__note">
          Kein Konto, keine E-Mail. Deine Spuren bleiben auf diesem Gerät.<br>
          Bestand ${entries.length} · Angesehen ${secured} · Offen ${pendingCandidates().length}
        </p>

        <nav class="menu__list">
          ${ITEMS.map(
            (item) => `
            <button class="menu__item" type="button" data-menu="${item.id}">
              <span>${esc(item.label)}</span>
              <em>${esc(item.hint())}</em>
            </button>`,
          ).join('')}
        </nav>

        <div class="menu__foot">
          <button class="btn-line" type="button" id="menu-back">
            ${mode === 'start' ? 'Das Haus betreten' : 'Zurück ins Haus'} · ESC
          </button>
        </div>
      </div>`;
  }

  function show(which = 'pause') {
    mode = which;
    open = true;
    render();
    root.hidden = false;
    root.querySelector('#menu-back')?.focus({ preventScroll: true });
  }

  function hide() {
    open = false;
    root.hidden = true;
    root.innerHTML = '';
  }

  root.addEventListener('click', (event) => {
    const item = event.target.closest('[data-menu]');
    if (item) {
      actionHandler?.(item.dataset.menu);
      return;
    }
    if (event.target.closest('#menu-back')) {
      actionHandler?.('close');
    }
  });

  return {
    show,
    hide,
    get isOpen() {
      return open;
    },
    onAction(fn) {
      actionHandler = fn;
    },
  };
}
