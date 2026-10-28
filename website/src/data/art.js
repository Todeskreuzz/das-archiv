/**
 * Generierte Exponat-Grafiken.
 * Jedes Poster ist ein eigenes kleines SVG — kein externes Bild, kein Netz nötig.
 */
import { mix, esc } from '../util.js';

const MOTIFS = {
  crt: (a, d, w) => `
    <rect x="-40" y="-33" width="80" height="60" rx="6" fill="${d}" stroke="${a}" stroke-width="2.5"/>
    <rect x="-32" y="-26" width="64" height="42" rx="3" fill="${a}" opacity="0.2"/>
    ${[0, 1, 2, 3, 4, 5]
      .map((i) => `<rect x="-30" y="${-23 + i * 7}" width="60" height="1.6" fill="${a}" opacity="0.45"/>`)
      .join('')}
    <rect x="-11" y="27" width="22" height="6" fill="${d}"/>
    <rect x="-24" y="33" width="48" height="5" rx="2.5" fill="${d}"/>
    <circle cx="34" cy="25" r="2.4" fill="${w}" opacity="0.7"/>`,
  news: (a, d, w) => `
    <rect x="-35" y="-36" width="70" height="70" rx="3" fill="${w}" opacity="0.94"/>
    <rect x="-28" y="-29" width="28" height="20" fill="${a}" opacity="0.85"/>
    ${[0, 1, 2, 3, 4]
      .map((i) => `<rect x="${-28 + (i % 2) * 0}" y="${-4 + i * 7}" width="${i === 4 ? 34 : 56}" height="3" fill="${d}" opacity="0.5"/>`)
      .join('')}
    <rect x="4" y="-29" width="24" height="20" fill="${d}" opacity="0.18"/>`,
  social: (a, d, w) => `
    <circle cx="-22" cy="4" r="11" fill="${a}" opacity="0.85"/>
    <path d="M-39 34a17 17 0 0 1 34 0z" fill="${a}" opacity="0.45"/>
    <circle cx="0" cy="-8" r="13" fill="${a}"/>
    <path d="M-21 30a21 21 0 0 1 42 0z" fill="${a}" opacity="0.7"/>
    <circle cx="23" cy="6" r="10" fill="${a}" opacity="0.7"/>
    <path d="M8 34a15 15 0 0 1 30 0z" fill="${a}" opacity="0.35"/>`,
  book: (a, d, w) => `
    <path d="M-42 26V-16q22-9 42 2 20-11 42-2v42q-22-9-42 2-20-11-42-2z" fill="${a}" opacity="0.9"/>
    <path d="M0 -14v42" stroke="${d}" stroke-width="3" opacity="0.6"/>
    ${[-32, -24, -16, 16, 24, 32]
      .map((x) => `<rect x="${x}" y="${x < 0 ? -6 : -6}" width="4" height="20" fill="${d}" opacity="0.22"/>`)
      .join('')}`,
  hen: (a, d, w) => `
    <ellipse cx="4" cy="10" rx="22" ry="17" fill="${a}"/>
    <circle cx="-15" cy="-12" r="11" fill="${a}"/>
    <path d="M-26 -12l-11 4 11 4z" fill="${w}"/>
    <circle cx="-18" cy="-15" r="2.2" fill="${d}"/>
    <path d="M-20 -25l3 6 4-7 4 8" stroke="${w}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M-6 24l-4 12M10 24l4 12" stroke="${w}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-22 8q-10 4-16 0" stroke="${d}" stroke-width="2.5" fill="none" opacity="0.4"/>`,
  cabinet: (a, d, w) => `
    <rect x="-27" y="-45" width="54" height="90" rx="7" fill="${d}" stroke="${a}" stroke-width="2"/>
    <rect x="-21" y="-39" width="42" height="15" rx="2" fill="${a}" opacity="0.9"/>
    <rect x="-21" y="-19" width="42" height="31" rx="2" fill="#05070d"/>
    <rect x="-17" y="-15" width="34" height="23" rx="1" fill="${a}" opacity="0.55"/>
    <circle cx="-8" cy="20" r="4.5" fill="${a}"/>
    <circle cx="8" cy="21" r="3.2" fill="${w}" opacity="0.6"/>
    <rect x="-21" y="30" width="42" height="7" rx="2" fill="${a}" opacity="0.3"/>`,
  clock: (a, d, w) => `
    <circle r="38" fill="none" stroke="${a}" stroke-width="6"/>
    ${Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const x1 = Math.sin(angle) * 30;
      const y1 = -Math.cos(angle) * 30;
      const x2 = Math.sin(angle) * 34;
      const y2 = -Math.cos(angle) * 34;
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${a}" stroke-width="2.4" opacity="0.8"/>`;
    }).join('')}
    <line x1="0" y1="0" x2="0" y2="-24" stroke="${w}" stroke-width="4" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="15" y2="10" stroke="${w}" stroke-width="3" stroke-linecap="round"/>
    <circle r="4" fill="${a}"/>`,
  ampel: (a, d, w) => `
    <rect x="-17" y="-43" width="34" height="86" rx="10" fill="${d}" stroke="${a}" stroke-width="2.5"/>
    <circle cy="-27" r="8.5" fill="#ff6b6b"/>
    <circle cy="0" r="8.5" fill="#ffb457" opacity="0.9"/>
    <circle cy="27" r="8.5" fill="#7ee081"/>
    <rect x="-2" y="43" width="4" height="8" fill="${a}" opacity="0.6"/>`,
  moon: (a, d, w) => `
    <circle r="31" fill="${a}"/>
    <circle cx="-10" cy="-9" r="7" fill="${d}" opacity="0.2"/>
    <circle cx="9" cy="4" r="5" fill="${d}" opacity="0.16"/>
    <circle cx="-1" cy="15" r="3.4" fill="${d}" opacity="0.18"/>
    <circle cx="13" cy="-13" r="2.4" fill="${d}" opacity="0.14"/>
    <path d="M30-30l2.5 5.5 5.5 2.5-5.5 2.5L30-14l-2.5-5.5L22-22l5.5-2.5z" fill="${w}" opacity="0.55"/>
    <circle cx="-32" cy="20" r="1.8" fill="${w}" opacity="0.4"/>`,
  mouse: (a, d, w) => `
    <circle cx="-23" cy="-17" r="12" fill="${a}"/>
    <circle cx="23" cy="-17" r="12" fill="${a}"/>
    <circle cx="-23" cy="-17" r="6" fill="${w}" opacity="0.25"/>
    <circle cx="23" cy="-17" r="6" fill="${w}" opacity="0.25"/>
    <circle cy="8" r="25" fill="${a}"/>
    <ellipse cx="0" cy="18" rx="13" ry="9" fill="${w}" opacity="0.22"/>
    <circle cx="-10" cy="4" r="3.4" fill="${d}"/>
    <circle cx="10" cy="4" r="3.4" fill="${d}"/>
    <circle cy="16" r="4" fill="${d}"/>`,
  counter: (a, d, w) => `
    <rect x="-44" y="-21" width="88" height="42" rx="5" fill="#07120c" stroke="${a}" stroke-width="2"/>
    <text x="0" y="9" text-anchor="middle" font-family="ui-monospace, monospace" font-size="24" letter-spacing="3" fill="${a}">0 0 4 7</text>
    <circle cx="-36" cy="-13" r="2" fill="${a}" opacity="0.7"/>`,
  sign: (a, d, w) => `
    <path d="M0 -40 44 34H-44Z" fill="${a}" stroke="${d}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="-4.5" y="-16" width="9" height="28" rx="2" fill="${d}"/>
    <circle cy="22" r="5.5" fill="${d}"/>`,
  badge: (a, d, w) => `
    <path d="M0 -40 35 -20V20L0 40 -35 20V-20Z" fill="${d}" stroke="${a}" stroke-width="2.5"/>
    <path d="M0 -17 6 -2 22 0 10 10 13 26 0 18 -13 26 -10 10 -22 0 -6 -2Z" fill="${a}"/>`,
  n: (a, d, w) => `
    <circle r="40" fill="${a}" opacity="0.14"/>
    <circle r="40" fill="none" stroke="${a}" stroke-width="2" opacity="0.5"/>
    <text x="0" y="17" text-anchor="middle" font-family="Georgia, serif" font-size="54" font-weight="700" fill="${a}">N</text>`,
  tile: (a, d, w) => `
    <rect x="-40" y="-21" width="80" height="42" rx="3" fill="${a}" opacity="0.18" stroke="${a}" stroke-width="2"/>
    <text x="0" y="6" text-anchor="middle" font-family="ui-monospace, monospace" font-size="15" letter-spacing="1" fill="${a}">88 x 31</text>`,
  cd: (a, d, w) => `
    <circle r="38" fill="${a}" opacity="0.85"/>
    <circle r="30" fill="none" stroke="${w}" stroke-width="1.5" opacity="0.35"/>
    <circle r="22" fill="none" stroke="${w}" stroke-width="1.2" opacity="0.22"/>
    <circle r="9" fill="${d}"/>
    <path d="M-30 -18a36 36 0 0 1 22-16" stroke="${w}" stroke-width="4" fill="none" opacity="0.6" stroke-linecap="round"/>`,
  blink: (a, d, w) => `
    <rect x="-40" y="-24" width="80" height="48" rx="3" fill="${a}" opacity="0.14" stroke="${a}" stroke-width="2" stroke-dasharray="5 5"/>
    <text x="0" y="7" text-anchor="middle" font-family="ui-monospace, monospace" font-size="19" letter-spacing="2" fill="${a}">BLINK</text>
    <path d="M-46 0h-6M46 0h6M0 -34v-6M0 34v6" stroke="${a}" stroke-width="2.5" opacity="0.55"/>`,
  hourglass: (a, d, w) => `
    <path d="M-21 -34H21L3 -2 21 34H-21L-3 -2Z" fill="${a}" opacity="0.9"/>
    <rect x="-25" y="-38" width="50" height="5" rx="2.5" fill="${w}" opacity="0.8"/>
    <rect x="-25" y="33" width="50" height="5" rx="2.5" fill="${w}" opacity="0.8"/>
    <path d="M-3 -2 21 34H-21Z" fill="${w}" opacity="0.2"/>`,
  modem: (a, d, w) => `
    <rect x="-40" y="-14" width="80" height="36" rx="6" fill="${d}" stroke="${a}" stroke-width="2.5"/>
    <circle cx="-24" cy="4" r="3" fill="${a}"/>
    <circle cx="-13" cy="4" r="3" fill="${a}" opacity="0.6"/>
    <circle cx="-2" cy="4" r="3" fill="${a}" opacity="0.3"/>
    <path d="M40 4q12 0 12 12t12 12" stroke="${a}" stroke-width="3" fill="none" opacity="0.6"/>
    <path d="M-26 -14v-8h52v8" stroke="${a}" stroke-width="2" fill="none" opacity="0.4"/>`,
  mail: (a, d, w) => `
    <rect x="-38" y="-25" width="76" height="52" rx="3" fill="${w}" opacity="0.94"/>
    <path d="M-38 -25 0 6 38 -25" fill="none" stroke="${a}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M-38 27 0 -4 38 27" fill="none" stroke="${a}" stroke-width="2" opacity="0.35"/>`,
  search: (a, d, w) => `
    <circle cx="-7" cy="-7" r="26" fill="none" stroke="${a}" stroke-width="6"/>
    <line x1="14" y1="14" x2="35" y2="35" stroke="${a}" stroke-width="9" stroke-linecap="round"/>
    <circle cx="-7" cy="-7" r="16" fill="${a}" opacity="0.12"/>`,
  eye: (a, d, w) => `
    <path d="M-42 0Q0 -30 42 0 0 30 -42 0Z" fill="none" stroke="${a}" stroke-width="4"/>
    <circle r="12" fill="${a}"/>
    <circle r="5" fill="${d}"/>
    <circle cx="-4" cy="-4" r="2" fill="${w}" opacity="0.8"/>`,
  gate: (a, d, w) => `
    <path d="M-26 36V-4a26 26 0 0 1 52 0v40Z" fill="${a}" opacity="0.2" stroke="${a}" stroke-width="3"/>
    <line x1="0" y1="-30" x2="0" y2="36" stroke="${a}" stroke-width="2" opacity="0.6"/>
    <circle cx="-7" cy="12" r="3" fill="${a}"/>`,
  castle: (a, d, w) => `
    <rect x="-32" y="-8" width="64" height="42" fill="${a}" opacity="0.9"/>
    <rect x="-40" y="-26" width="16" height="60" fill="${a}"/>
    <rect x="24" y="-26" width="16" height="60" fill="${a}"/>
    <rect x="-40" y="-34" width="7" height="9" fill="${a}"/>
    <rect x="-31" y="-34" width="7" height="9" fill="${a}"/>
    <rect x="24" y="-34" width="7" height="9" fill="${a}"/>
    <rect x="33" y="-34" width="7" height="9" fill="${a}"/>
    <path d="M-11 34V16a11 11 0 0 1 22 0v18Z" fill="${d}"/>
    <rect x="-14" y="-8" width="7" height="9" fill="${d}"/>
    <rect x="7" y="-8" width="7" height="9" fill="${d}"/>
    <line x1="0" y1="-34" x2="0" y2="-46" stroke="${a}" stroke-width="2"/>
    <path d="M0 -46l16 5-16 5z" fill="${w}" opacity="0.8"/>`,
  rocket: (a, d, w) => `
    <path d="M0 -42c13 13 17 27 17 41v10H-17V-1c0-14 4-28 17-41z" fill="${a}"/>
    <circle cy="-10" r="7.5" fill="${d}"/>
    <path d="M-17 8l-14 20 14-5zM17 8l14 20-14-5z" fill="${a}" opacity="0.75"/>
    <path d="M-7 20h14l-7 19z" fill="${w}" opacity="0.8"/>`,
  amphora: (a, d, w) => `
    <rect x="-13" y="-40" width="26" height="6" rx="3" fill="${a}"/>
    <path d="M-9 -34h18l-2 10c11 6 16 16 16 27 0 17-10 27-23 27S-23 20-23 3c0-11 5-21 16-27z" fill="${a}"/>
    <path d="M-23 4h46" stroke="${d}" stroke-width="3" opacity="0.35"/>
    <path d="M-14 20q14 8 28 0" stroke="${w}" stroke-width="2.5" fill="none" opacity="0.45"/>`,
  bat: (a, d, w) => `
    <path d="M-9 -14l-4 -15 11 9zM9 -14l4 -15-11 9z" fill="${a}"/>
    <path d="M0 -8c-7-11-18-15-30-13 6 7 8 13 8 19-5 0-9-2-13-6 0 11 5 19 13 25-3 5-7 7-12 9 13 7 24 2 34-8 10 10 21 15 34 8-5-2-9-4-12-9 8-6 13-14 13-25-4 4-8 6-13 6 0-6 2-12 8-19C18-23 7-19 0-8z" fill="${a}"/>
    <circle cy="0" r="3.4" fill="${d}"/>`,
  bottle: (a, d, w) => `
    <rect x="-6" y="-41" width="12" height="20" rx="2" fill="${a}"/>
    <path d="M-6 -22c-10 7-14 15-14 26 0 18 9 31 20 31s20-13 20-31c0-11-4-19-14-26z" fill="${a}"/>
    <rect x="-17" y="2" width="34" height="8" fill="${w}" opacity="0.4"/>
    <path d="M-12 26h24" stroke="${d}" stroke-width="2.5" opacity="0.22"/>`,
  dice: (a, d, w) => `
    <rect x="-31" y="-31" width="62" height="62" rx="11" fill="${a}"/>
    <circle cx="-15" cy="-15" r="5" fill="${d}"/>
    <circle cx="15" cy="-15" r="5" fill="${d}"/>
    <circle cy="0" r="5" fill="${d}"/>
    <circle cx="-15" cy="15" r="5" fill="${d}"/>
    <circle cx="15" cy="15" r="5" fill="${d}"/>`,
  wheat: (a, d, w) => `
    <line x1="0" y1="38" x2="0" y2="-32" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
    ${[-24, -12, 0, 12]
      .map(
        (y) => `
      <ellipse cx="-11" cy="${y}" rx="5.5" ry="10" transform="rotate(-28 -11 ${y})" fill="${a}"/>
      <ellipse cx="11" cy="${y}" rx="5.5" ry="10" transform="rotate(28 11 ${y})" fill="${a}"/>`,
      )
      .join('')}
    <ellipse cy="-36" rx="5" ry="10" fill="${a}"/>`,
  sword: (a, d, w) => `
    <path d="M0 -42l8 9v34H-8v-34z" fill="${a}"/>
    <rect x="-19" y="1" width="38" height="7" rx="3.5" fill="${w}" opacity="0.85"/>
    <rect x="-5" y="8" width="10" height="20" rx="4" fill="${d}" opacity="0.8"/>
    <circle cy="32" r="5" fill="${a}"/>`,
};

const FALLBACK = MOTIFS.badge;

export function motif(name, accent, dark, light) {
  const draw = MOTIFS[name] || FALLBACK;
  return draw(accent, dark, light);
}

/**
 * Baut ein vollständiges Poster-SVG für ein Exponat.
 */
export function poster(entry, { compact = false } = {}) {
  const accent = entry.accent || '#d8a441';
  const bg1 = mix(accent, '#0a1020', 0.86);
  const bg2 = mix(accent, '#05080f', 0.94);
  const dark = mix(accent, '#05070d', 0.9);
  const light = '#f3ecdb';
  const uid = `p${String(entry.id || 'x').replace(/[^a-z0-9]/gi, '')}`;
  const labels = compact
    ? ''
    : `
    <text x="24" y="38" font-family="ui-monospace, monospace" font-size="9.5" letter-spacing="2.4" fill="${accent}" opacity="0.85">${esc((entry.kind || 'EXPONAT').toUpperCase())}</text>
    <text x="276" y="38" text-anchor="end" font-family="ui-monospace, monospace" font-size="9" letter-spacing="1.6" fill="${light}" opacity="0.4">${esc(String(entry.year || '—'))}</text>
    <text x="24" y="282" font-family="Georgia, serif" font-size="15" fill="${light}" opacity="0.72">${esc(entry.rarity === 'einzigartig' ? 'Einzelstück' : entry.rarity === 'selten' ? 'Selten' : 'Bestand')}</text>
    <text x="276" y="282" text-anchor="end" font-family="ui-monospace, monospace" font-size="9" letter-spacing="1.4" fill="${accent}" opacity="0.75">ARCHIV</text>`;

  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(entry.title)} — Exponatgrafik">
    <defs>
      <linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bg1}"/>
        <stop offset="1" stop-color="${bg2}"/>
      </linearGradient>
      <radialGradient id="${uid}glow" cx="50%" cy="46%" r="52%">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.34"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="300" height="300" fill="url(#${uid}bg)"/>
    <rect width="300" height="300" fill="url(#${uid}glow)"/>
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 36 + 18}" x2="300" y2="${i * 36 + 18}" stroke="${accent}" stroke-width="0.7" opacity="0.09"/>`).join('')}
    <rect x="10" y="10" width="280" height="280" fill="none" stroke="${accent}" stroke-width="1" opacity="0.28"/>
    <g transform="translate(150 ${compact ? 150 : 146}) scale(${compact ? 1.62 : 1.42})">
      ${motif(entry.motif, accent, dark, light)}
    </g>
    ${labels}
  </svg>`;
}

export function curatorSigil(size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path d="M2 12Q12 4 22 12 12 20 2 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <circle cx="12" cy="12" r="4" fill="currentColor"/>
    <circle cx="10.4" cy="10.6" r="1.3" fill="#070b16"/>
  </svg>`;
}

export function buildingMark(size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path d="M3 21V10L12 4l9 6v11z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M9 21v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/>
    <path d="M7 11h2M15 11h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`;
}
