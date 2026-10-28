/** Kleine Helfer, die überall gebraucht werden. */

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** #rrggbb mischen. t=0 => a, t=1 => b */
export function mix(a, b, t) {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function alpha(hex, a) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

export function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** FNV-1a, stabil über Sitzungen hinweg. */
export function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickSeeded(list, seed) {
  if (!list.length) return undefined;
  return list[hash(String(seed)) % list.length];
}

export function shuffleSeeded(list, seed) {
  const out = [...list];
  let s = hash(String(seed)) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function uid(prefix = 'u') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
