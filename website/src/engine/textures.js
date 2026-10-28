import * as THREE from '../../vendor/three.module.js';

/** Zeichnet auf ein Canvas und gibt eine Three-Textur zurück. */
export function canvasTexture(draw, width = 512, height = 512, { repeat, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

let noiseSeed = 1337;
function rand() {
  noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
  return noiseSeed / 4294967296;
}

function speckle(ctx, w, h, amount, alpha) {
  for (let i = 0; i < amount; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 1.8 + 0.3;
    ctx.fillStyle = `rgba(255,255,255,${alpha * rand()})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ Böden */

export function stoneFloorTexture() {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#121722';
      ctx.fillRect(0, 0, w, h);
      // große Platten
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const shade = 18 + Math.floor(rand() * 12);
          ctx.fillStyle = `rgb(${shade + 4},${shade + 8},${shade + 18})`;
          ctx.fillRect(x * (w / 4) + 2, y * (h / 4) + 2, w / 4 - 4, h / 4 - 4);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo((w / 4) * i, 0);
        ctx.lineTo((w / 4) * i, h);
        ctx.moveTo(0, (h / 4) * i);
        ctx.lineTo(w, (h / 4) * i);
        ctx.stroke();
      }
      speckle(ctx, w, h, 900, 0.05);
      const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1024,
    1024,
  );
}

export function woodFloorTexture(base = '#3a2718', accent = '#241608') {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const plank = w / 8;
      for (let i = 0; i < 8; i += 1) {
        ctx.fillStyle = i % 2 ? accent : base;
        ctx.fillRect(i * plank, 0, plank, h);
        for (let j = 0; j < 40; j += 1) {
          ctx.strokeStyle = `rgba(0,0,0,${0.04 + rand() * 0.08})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          const y = rand() * h;
          ctx.moveTo(i * plank + 2, y);
          ctx.lineTo(i * plank + plank - 2, y + (rand() * 8 - 4));
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(i * plank, 0, 2, h);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,220,170,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1024,
    1024,
  );
}

export function checkerTexture() {
  return canvasTexture(
    (ctx, w, h) => {
      const cells = 8;
      const size = w / cells;
      for (let y = 0; y < cells; y += 1) {
        for (let x = 0; x < cells; x += 1) {
          const even = (x + y) % 2 === 0;
          ctx.fillStyle = even ? '#1b1026' : '#0b0712';
          ctx.fillRect(x * size, y * size, size, size);
        }
      }
      ctx.strokeStyle = 'rgba(255,77,157,0.10)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= cells; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * size, 0);
        ctx.lineTo(i * size, h);
        ctx.moveTo(0, i * size);
        ctx.lineTo(w, i * size);
        ctx.stroke();
      }
      const grad = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.7);
      grad.addColorStop(0, 'rgba(255,77,157,0.10)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1024,
    1024,
  );
}

export function wallTexture(base = '#1a2133') {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 1200, 0.035);
      for (let i = 0; i < 26; i += 1) {
        ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.05})`;
        ctx.fillRect(rand() * w, rand() * h, rand() * 90 + 10, rand() * 4 + 1);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(0,0,0,0.25)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    512,
    512,
  );
}

/* ------------------------------------------------------------------ Licht */

/** Weicher Lichtkegel für Wände hinter Bildern. */
export function glowTexture(color = '255,180,87') {
  return canvasTexture(
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, `rgba(${color},0.55)`);
      grad.addColorStop(0.45, `rgba(${color},0.14)`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    256,
    256,
  );
}

/* ------------------------------------------------------------------ Schrift */

const FONT = '"Iowan Old Style", "Palatino Linotype", Georgia, serif';
const MONO = '"Cascadia Mono", Consolas, ui-monospace, monospace';

/**
 * Erzeugt eine Textur mit Text und gibt Seitenverhältnis mit zurück.
 */
export function textTexture(text, options = {}) {
  const {
    width = 1024,
    height = 192,
    color = '#f0c878',
    font = `600 96px ${FONT}`,
    letterSpacing = 0,
    align = 'center',
    shadow = null,
    lineWidth = 0,
  } = options;
  return canvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (lineWidth) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(lineWidth, lineWidth, w - lineWidth * 2, h - lineWidth * 2);
      }
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      if (shadow) {
        ctx.shadowColor = shadow;
        ctx.shadowBlur = 28;
      }
      const x = align === 'center' ? w / 2 : align === 'left' ? 24 : w - 24;
      if (letterSpacing && 'letterSpacing' in ctx) {
        ctx.letterSpacing = `${letterSpacing}px`;
      }
      ctx.fillText(text, x, h / 2 + 2);
    },
    width,
    height,
  );
}

export function plaqueTexture(title, subtitle) {  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#12182a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(216,164,65,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f3ecdb';
      ctx.font = `600 30px ${FONT}`;
      ctx.fillText(title.slice(0, 34), w / 2, h / 2 - 6);
      ctx.fillStyle = '#d8a441';
      ctx.font = `15px ${MONO}`;
      ctx.fillText(subtitle.toUpperCase(), w / 2, h / 2 + 26);
    },
    512,
    128,
  );
}

/** Bildschirm einer Konsole im Foyer. */
export function consoleTexture(title, subtitle, accent = '#6ee7d7') {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#050a12';
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
      glow.addColorStop(0, `${accent}33`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, w - 28, h - 28);

      ctx.textAlign = 'center';
      ctx.fillStyle = accent;
      const fontSize = title.length > 10 ? 52 : 70;
      ctx.font = `600 ${fontSize}px ${FONT}`;
      ctx.fillText(title, w / 2, h / 2 + 6);

      ctx.fillStyle = '#8b96ae';
      ctx.font = `22px ${MONO}`;
      ctx.fillText(subtitle.toUpperCase(), w / 2, h / 2 + 62);

      // Scanlinien
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    },
    512,
    384,
  );
}

export function svgTexture(svg, size = 512) {
  return new Promise((resolve) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const texture = canvasTexture(
        (ctx) => {
          ctx.fillStyle = '#0b1020';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(image, 0, 0, size, size);
        },
        size,
        size,
      );
      URL.revokeObjectURL(url);
      resolve(texture);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

/* ------------------------------------------------------------------ Figur */

/** Grob gerastertes Gesicht für den Bildschirmkopf. */
export function faceTexture(mood = 'neutral') {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#070b12';
      ctx.fillRect(0, 0, w, h);

      // Kopf
      ctx.fillStyle = '#cfc7b2';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.48, w * 0.34, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Schatten links
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(w * 0.36, h * 0.5, w * 0.22, h * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      // Augen
      const eyeY = h * 0.42;
      ctx.fillStyle = '#080c14';
      if (mood === 'closed') {
        ctx.fillRect(w * 0.27, eyeY, w * 0.16, 3);
        ctx.fillRect(w * 0.57, eyeY, w * 0.16, 3);
      } else {
        ctx.fillRect(w * 0.28, eyeY - 5, w * 0.15, 10);
        ctx.fillRect(w * 0.57, eyeY - 5, w * 0.15, 10);
        ctx.fillStyle = '#f3ecdb';
        ctx.fillRect(w * 0.31, eyeY - 3, w * 0.04, 4);
        ctx.fillRect(w * 0.60, eyeY - 3, w * 0.04, 4);
      }

      // Brauen
      ctx.fillStyle = 'rgba(10,14,22,0.85)';
      ctx.fillRect(w * 0.27, eyeY - 14, w * 0.17, 3);
      ctx.fillRect(w * 0.56, eyeY - 14, w * 0.17, 3);

      // Nase
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(w * 0.47, h * 0.44, w * 0.07, h * 0.14);

      // Mund
      ctx.fillStyle = '#0a0e16';
      if (mood === 'streng') {
        ctx.fillRect(w * 0.38, h * 0.66, w * 0.24, 3);
        ctx.fillRect(w * 0.38, h * 0.66, 3, 5);
        ctx.fillRect(w * 0.38 + w * 0.24 - 3, h * 0.66, 3, 5);
      } else if (mood === 'freundlich') {
        ctx.fillRect(w * 0.38, h * 0.66, w * 0.24, 3);
        ctx.fillRect(w * 0.38, h * 0.66 - 4, 3, 4);
        ctx.fillRect(w * 0.38 + w * 0.24 - 3, h * 0.66 - 4, 3, 4);
      } else {
        ctx.fillRect(w * 0.39, h * 0.66, w * 0.22, 3);
      }

      // Scanzeilen
      ctx.fillStyle = 'rgba(4,7,12,0.55)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      // Rahmen
      ctx.strokeStyle = 'rgba(110,231,215,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, w - 6, h - 6);
    },
    128,
    160,
  );
}

/** Gewebe des Mantels: feine Streifen, leicht ausgefranst. */
export function coatTexture() {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.fillStyle = '#4c5768';
      ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 3) {
        ctx.fillStyle = x % 9 === 0 ? '#6b788d' : '#333b49';
        ctx.fillRect(x, 0, 1, h);
      }
      for (let i = 0; i < 90; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.05})`;
        ctx.fillRect(rand() * w, rand() * h, 1, rand() * 6 + 1);
      }
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,255,255,0.10)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    128,
    256,
  );
}

/** Texteingabe für 3D-Beschriftungen, im UI-Stil. */
export function plateTexture(lines, { width = 512, height = 128, color = '#e8e2d0', border = true } = {}) {
  return canvasTexture(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      if (border) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
      }
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rows = Array.isArray(lines) ? lines : [lines];
      const step = h / (rows.length + 1);
      rows.forEach((line, i) => {
        ctx.font = `${i === 0 ? 600 : 400} ${i === 0 ? 46 : 26}px ${MONO}`;
        ctx.fillText(line.toUpperCase(), w / 2, step * (i + 1));
      });
    },
    width,
    height,
  );
}

export { FONT, MONO };

