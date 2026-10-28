/**
 * Die Verbindung zur Brücke.
 *
 * Der Browser entscheidet nichts mehr selbst, wenn die Leitung steht:
 * Gedanken, Ziele und Funde kommen als Ereignisse über den Strom.
 */

export function createLink({ onEvent, onStatus } = {}) {
  let source = null;
  let status = { mode: 'offline', model: '' };
  let stateTimer = null;
  let lastState = null;

  function setStatus(next) {
    status = { ...status, ...next };
    onStatus?.(status);
  }

  function connect() {
    try {
      source = new EventSource('/brain/stream');
    } catch {
      setStatus({ mode: 'offline' });
      return;
    }

    source.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === 'status') {
        setStatus({ mode: data.mode, model: data.model });
        return;
      }
      onEvent?.(data);
    };

    source.onerror = () => {
      setStatus({ mode: 'offline' });
    };
  }

  function pushState(payload) {
    lastState = payload;
    fetch('/brain/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function startHeartbeat() {
    if (stateTimer) return;
    stateTimer = setInterval(() => {
      if (lastState) pushState(lastState);
    }, 12000);
  }

  async function send(message, context) {
    try {
      const response = await fetch('/brain/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, context }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch {
      setStatus({ mode: 'offline' });
      return null;
    }
  }

  connect();
  startHeartbeat();

  return {
    send,
    pushState,
    get status() {
      return status;
    },
    get online() {
      return status.mode === 'live' || status.mode === 'local';
    },
    close() {
      source?.close();
      if (stateTimer) clearInterval(stateTimer);
    },
  };
}
