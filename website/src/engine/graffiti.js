import * as THREE from '../../vendor/three.module.js';

/**
 * Wände, die beschrieben werden.
 *
 * Jede Wand hat eine eigene Leinwand. Striche und Notizen kommen von der Brücke,
 * werden lokal nachgezeichnet und als Textur auf die Wand gelegt.
 */

const W = 1024;
const H = 512;

export function createGraffiti() {
  const walls = new Map();

  function ensure(id) {
    if (walls.has(id)) return walls.get(id);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const wall = {
      id,
      canvas,
      ctx: canvas.getContext('2d'),
      texture,
      strokes: [],
      notes: [],
    };
    walls.set(id, wall);
    return wall;
  }

  function drawStroke(ctx, stroke) {
    const points = stroke.points || [];
    if (points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = stroke.color || '#e8e2d0';
    ctx.lineWidth = Math.max(1, stroke.width || 3);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0] * W, points[0][1] * H);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i][0] * W, points[i][1] * H);
    }
    ctx.stroke();
    ctx.restore();
  }

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 6);
  }

  function drawNote(ctx, note) {
    const x = note.x * W;
    const y = note.y * H;
    const width = 220;
    ctx.save();
    ctx.font = '600 17px "Cascadia Mono", Consolas, monospace';
    const lines = wrapText(ctx, note.text, width - 24);
    const height = 34 + lines.length * 22;

    ctx.translate(x, y);
    ctx.rotate(-0.02);
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#d6cdb4';
    ctx.fillRect(0, 0, width, 6);
    // Stift
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(width / 2 - 4, 0, 8, 10);

    ctx.fillStyle = '#14181f';
    ctx.font = '600 17px "Cascadia Mono", Consolas, monospace';
    lines.forEach((line, index) => {
      ctx.fillText(line, 12, 34 + index * 22);
    });
    ctx.restore();
  }

  function redraw(id) {
    const wall = ensure(id);
    const { ctx, canvas, texture } = wall;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of wall.strokes) drawStroke(ctx, stroke);
    for (const note of wall.notes) drawNote(ctx, note);
    texture.needsUpdate = true;
    return wall;
  }

  function apply(entry) {
    if (!entry || !entry.wall) return;
    const wall = ensure(entry.wall);
    if (entry.stroke) {
      wall.strokes.push(entry.stroke);
      if (wall.strokes.length > 400) wall.strokes.shift();
      drawStroke(wall.ctx, entry.stroke);
      wall.texture.needsUpdate = true;
    }
    if (entry.note) {
      wall.notes.push(entry.note);
      if (wall.notes.length > 60) wall.notes.shift();
      redraw(entry.wall);
    }
  }

  function hydrate(data) {
    const source = data?.walls || {};
    for (const [id, value] of Object.entries(source)) {
      const wall = ensure(id);
      wall.strokes = Array.isArray(value.strokes) ? value.strokes : [];
      wall.notes = Array.isArray(value.notes) ? value.notes : [];
      redraw(id);
    }
  }

  async function load() {
    try {
      const response = await fetch('/graffiti');
      if (!response.ok) return;
      hydrate(await response.json());
    } catch {
      /* Ohne Brücke bleiben die Wände leer. */
    }
  }

  async function post(wall, payload) {
    apply({ wall, ...payload });
    try {
      await fetch('/graffiti', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wall, ...payload }),
      });
    } catch {
      /* Lokal bleibt es sichtbar. */
    }
  }

  function wallData(id) {
    const wall = ensure(id);
    return { strokes: wall.strokes, notes: wall.notes, canvas: wall.canvas };
  }

  function textureFor(id) {
    return ensure(id).texture;
  }

  function noteCount() {
    let count = 0;
    for (const wall of walls.values()) count += wall.notes.length;
    return count;
  }

  function strokeCount() {
    let count = 0;
    for (const wall of walls.values()) count += wall.strokes.length;
    return count;
  }

  return { load, post, apply, textureFor, wallData, noteCount, strokeCount, W, H };
}
