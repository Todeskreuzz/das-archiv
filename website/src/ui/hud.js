import { esc, pad } from '../util.js';

export function createHud() {
  const hud = document.querySelector('#hud');
  const quote = document.querySelector('#ai-quote');
  const aiState = document.querySelector('#ai-state');
  const pointsEl = document.querySelector('#stat-total');
  const securedEl = document.querySelector('#stat-secured');
  const notesEl = document.querySelector('#stat-notes');
  const marksEl = document.querySelector('#stat-marks');
  const target = document.querySelector('#target');
  const targetLabel = document.querySelector('#target-label');
  const targetValue = document.querySelector('#target-value');
  const panel = document.querySelector('#panel');
  const card = document.querySelector('#panel-card');
  const toasts = document.querySelector('#toasts');

  let open = false;
  let onClose = null;
  let currentTarget = null;

  function setStats({ total, secured, notes, marks }) {
    pointsEl.textContent = pad(total, 2);
    securedEl.textContent = pad(secured, 2);
    notesEl.textContent = pad(notes, 0);
    marksEl.textContent = pad(marks, 0);
  }

  function say(text, status = 'BEREIT') {
    if (text) quote.textContent = text;
    aiState.textContent = status;
  }

  function setLink(mode) {
    const el = document.querySelector('#ai-link');
    if (!el) return;
    el.dataset.mode = mode;
    el.textContent = mode === 'live' ? 'LIVE' : mode === 'local' ? 'LOKAL' : 'OFFLINE';
  }

  function setTarget(data) {
    if (!data) {
      if (currentTarget) {
        target.hidden = true;
        currentTarget = null;
      }
      return;
    }
    const { label, value, rect } = data;
    if (!rect || rect.w < 2 || rect.h < 2) {
      target.hidden = true;
      currentTarget = null;
      return;
    }
    target.hidden = false;
    target.style.left = `${rect.x}px`;
    target.style.top = `${rect.y}px`;
    target.style.width = `${rect.w}px`;
    target.style.height = `${rect.h}px`;
    target.classList.toggle('is-large', rect.h > window.innerHeight * 0.6 || rect.w > window.innerWidth * 0.8);
    if (!currentTarget || currentTarget.label !== label) {
      targetLabel.textContent = label;
      targetValue.textContent = value || '';
      currentTarget = { label, value };
    }
  }

  function clearTarget() {
    setTarget(null);
  }

  function toast(text) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<span>${esc(text)}</span>`;
    toasts.append(node);
    setTimeout(() => {
      node.classList.add('toast--out');
      setTimeout(() => node.remove(), 220);
    }, 3200);
  }

  function openPanel(html, { onClose: closeHandler } = {}) {
    open = true;
    onClose = closeHandler || null;
    card.innerHTML = html;
    card.scrollTop = 0;
    panel.hidden = false;
    clearTarget();
    const focusTarget = card.querySelector('[data-close], button, input');
    focusTarget?.focus({ preventScroll: true });
  }

  function closePanel() {
    if (!open) return;
    open = false;
    panel.hidden = true;
    card.innerHTML = '';
    const handler = onClose;
    onClose = null;
    handler?.();
  }

  function show() {
    hud.hidden = false;
  }

  function hide() {
    hud.hidden = true;
  }

  function showTouch(value) {
    document.querySelector('#touch')?.toggleAttribute('hidden', !value);
  }

  return {
    setStats,
    say,
    setLink,
    setTarget,
    clearTarget,
    toast,
    openPanel,
    closePanel,
    show,
    hide,
    showTouch,
    get isOpen() {
      return open;
    },
  };
}
