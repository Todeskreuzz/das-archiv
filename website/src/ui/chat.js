import { esc } from '../util.js';

/**
 * Das Gesprächsfenster. Ein Terminal, kein Chat-Client.
 */
export function createChat({ onSend, onClose }) {
  const root = document.querySelector('#chat');
  const log = document.querySelector('#chat-log');
  const form = document.querySelector('#chat-form');
  const input = document.querySelector('#chat-input');
  const chips = document.querySelector('#chat-chips');

  let open = false;
  let busy = false;
  let history = 0;

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function add(who, text) {
    history += 1;
    const line = document.createElement('p');
    line.className = `chat__line chat__line--${who}`;
    line.innerHTML = `<span class="chat__who">${who === 'curator' ? 'KURATOR' : 'DU'}</span>${esc(text)}`;
    log.append(line);
    scrollDown();
    return line;
  }

  function typing() {
    const line = document.createElement('p');
    line.className = 'chat__line chat__line--curator chat__typing';
    line.textContent = '▍';
    log.append(line);
    scrollDown();
    return line;
  }

  function setSuggestions(list) {
    chips.innerHTML = list
      .map((text) => `<button type="button" class="chat__chip" data-say="${esc(text)}">${esc(text)}</button>`)
      .join('');
  }

  function show() {
    open = true;
    root.hidden = false;
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  function hide() {
    open = false;
    root.hidden = true;
    onClose?.();
  }

  function send(text) {
    const value = String(text || '').trim();
    if (!value || busy) return;
    add('player', value);
    input.value = '';
    busy = true;
    const pending = typing();
    setTimeout(() => {
      pending.remove();
      busy = false;
      onSend?.(value);
    }, 500 + Math.random() * 500);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    send(input.value);
  });

  chips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-say]');
    if (chip) send(chip.dataset.say);
  });

  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-chat-close]')) hide();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    }
  });

  return {
    show,
    hide,
    add,
    setSuggestions,
    get isOpen() {
      return open;
    },
    get isBusy() {
      return busy;
    },
    hasHistory() {
      return history > 0;
    },
    clear() {
      log.innerHTML = '';
      history = 0;
    },
  };
}
