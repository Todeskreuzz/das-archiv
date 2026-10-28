import { esc } from '../util.js';

/**
 * Die Wandtafel: zeichnen, schreiben, sehen, was andere hinterlassen haben.
 * Die Leinwand ist eine Kopie der Wand. Gespeichert werden nur die neuen Striche.
 */
export function wallPanel(surface) {
  const info = surface;
  return `
  <div class="sheet">
    <header class="sheet__head">
      <p class="kicker">Wand · ${esc(info?.room || 'Haus')}</p>
      <h2>${esc(info?.title || 'Wand')}</h2>
    </header>

    <div class="sheet__body">
      <p class="ballot__lead">
        Hier darfst du schreiben und zeichnen. Was du speicherst, bleibt an der Wand —
        für alle, die nach dir kommen.
      </p>

      <div class="wall-editor">
        <canvas id="wall-canvas" width="1024" height="512" aria-label="Wandfläche"></canvas>
      </div>

      <div class="wall-tools">
        <span class="kicker">Stift</span>
        <button type="button" class="swatch is-on" data-color="#e8e2d0" style="--c:#e8e2d0" aria-label="Papierweiß"></button>
        <button type="button" class="swatch" data-color="#ffcf6a" style="--c:#ffcf6a" aria-label="Bernstein"></button>
        <button type="button" class="swatch" data-color="#ff5a4a" style="--c:#ff5a4a" aria-label="Rot"></button>
        <button type="button" class="swatch" data-color="#6ee7d7" style="--c:#6ee7d7" aria-label="Zyan"></button>
        <span class="kicker">Stärke</span>
        <input type="range" id="wall-width" min="2" max="12" value="4">
        <button type="button" class="btn-line btn-line--tiny" data-wall-undo>Rückgängig</button>
        <button type="button" class="btn-line btn-line--tiny" data-wall-clear>Leeren</button>
      </div>

      <form id="wall-note" class="form wall-note">
        <label class="field">
          <span>Notiz an der Wand</span>
          <textarea name="note" rows="2" maxlength="220" placeholder="Ein Satz, der bleiben soll."></textarea>
        </label>
        <button class="btn-line" type="submit">An die Wand schreiben</button>
      </form>

      <p class="kicker" style="margin-top:18px">Bereits an dieser Wand</p>
      <ul class="wall-notes" id="wall-notes"></ul>
    </div>

    <footer class="sheet__foot">
      <button class="btn-solid" type="button" data-wall-save>Striche speichern</button>
      <button class="btn-line" type="button" data-close>Zurück · ESC</button>
    </footer>
  </div>`;
}

/**
 * Verbindet die Leinwand mit dem Speicher.
 * Gibt eine Aufräumfunktion zurück.
 */
export function mountWall(graffiti, wallId, { onChange } = {}) {
  const canvas = document.querySelector('#wall-canvas');
  if (!canvas) return () => {};

  const ctx = canvas.getContext('2d');
  const data = graffiti.wallData(wallId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(data.canvas, 0, 0);

  let color = '#e8e2d0';
  let width = 4;
  let drawing = false;
  let current = null;
  const pending = [];

  const list = document.querySelector('#wall-notes');
  const renderNotes = () => {
    if (!list) return;
    const notes = graffiti.wallData(wallId).notes;
    list.innerHTML = notes.length
      ? notes
          .slice(-8)
          .reverse()
          .map((note) => `<li>${esc(note.text)}</li>`)
          .join('')
      : '<li class="is-empty">Noch nichts. Du könntest die Erste sein.</li>';
  };
  renderNotes();

  const toLocal = (event) => {
    const rect = canvas.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  };

  const paint = (stroke) => {
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0] * canvas.width, stroke.points[0][1] * canvas.height);
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i][0] * canvas.width, stroke.points[i][1] * canvas.height);
    }
    ctx.stroke();
    ctx.restore();
  };

  const repaint = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(data.canvas, 0, 0);
    for (const stroke of pending) paint(stroke);
  };

  const onDown = (event) => {
    event.preventDefault();
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      /* Synthetische Zeiger haben keine Capture-Rechte. */
    }
    drawing = true;
    current = { color, width, points: [toLocal(event)] };
  };

  const onMove = (event) => {
    if (!drawing || !current) return;
    event.preventDefault();
    current.points.push(toLocal(event));
    paint({ ...current, points: current.points.slice(-2) });
  };

  const onUp = () => {
    if (!drawing || !current) return;
    drawing = false;
    if (current.points.length > 1) pending.push(current);
    current = null;
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  const colorButtons = [...document.querySelectorAll('.swatch')];
  const onColor = (event) => {
    const button = event.currentTarget;
    color = button.dataset.color;
    colorButtons.forEach((entry) => entry.classList.toggle('is-on', entry === button));
  };
  colorButtons.forEach((button) => button.addEventListener('click', onColor));

  const widthInput = document.querySelector('#wall-width');
  const onWidth = () => {
    width = Number(widthInput.value) || 4;
  };
  widthInput?.addEventListener('input', onWidth);

  const undo = () => {
    pending.pop();
    repaint();
  };
  const clear = () => {
    pending.length = 0;
    repaint();
  };

  const undoButton = document.querySelector('[data-wall-undo]');
  const clearButton = document.querySelector('[data-wall-clear]');
  undoButton?.addEventListener('click', undo);
  clearButton?.addEventListener('click', clear);

  const saveButton = document.querySelector('[data-wall-save]');
  const onSave = async () => {
    if (!pending.length) {
      saveButton.textContent = 'Nichts zu speichern';
      return;
    }
    const strokes = pending.splice(0, pending.length);
    saveButton.textContent = 'Gespeichert';
    repaint();
    for (const stroke of strokes) {
      await graffiti.post(wallId, { stroke });
    }
    onChange?.();
  };
  saveButton?.addEventListener('click', onSave);

  const form = document.querySelector('#wall-note');
  const onNote = async (event) => {
    event.preventDefault();
    const field = form.querySelector('textarea');
    const text = field.value.trim();
    if (!text) return;
    const index = graffiti.wallData(wallId).notes.length;
    const x = 0.08 + (index % 3) * 0.3;
    const y = 0.12 + Math.floor(index / 3) * 0.26;
    await graffiti.post(wallId, { note: { text, x, y } });
    field.value = '';
    renderNotes();
    onChange?.();
  };
  form?.addEventListener('submit', onNote);

  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    colorButtons.forEach((button) => button.removeEventListener('click', onColor));
    widthInput?.removeEventListener('input', onWidth);
    undoButton?.removeEventListener('click', undo);
    clearButton?.removeEventListener('click', clear);
    saveButton?.removeEventListener('click', onSave);
    form?.removeEventListener('submit', onNote);
  };
}
