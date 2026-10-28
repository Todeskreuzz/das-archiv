import { loadEnv, loadProviders, listProviders, detectProvider, chat } from './providers.mjs';

/**
 * Prüft alle eingerichteten Anbieter mit einer winzigen Anfrage.
 * Aufruf: node scripts/check-providers.mjs
 */

const env = { ...loadEnv(), ...process.env };
const providers = loadProviders();
const list = listProviders(env, providers);

console.log('');
console.log('  DAS ARCHIV — Anbieter-Prüfung');
console.log('');

let ready = 0;

for (const entry of list) {
  if (!entry.ready) {
    console.log(`  ○ ${entry.label.padEnd(24)} kein Schlüssel (${entry.envKey})`);
    continue;
  }

  ready += 1;
  const started = Date.now();
  try {
    const reply = await chat(
      entry,
      [
        { role: 'system', content: 'Antworte mit genau einem Wort.' },
        { role: 'user', content: 'Sag: bereit' },
      ],
      { maxTokens: 12, timeout: 25000 },
    );
    const text = String(reply).replace(/\s+/g, ' ').trim().slice(0, 48);
    console.log(`  ● ${entry.label.padEnd(24)} OK  ${String(Date.now() - started).padStart(5)} ms  "${text}"`);
  } catch (error) {
    console.log(`  × ${entry.label.padEnd(24)} FEHLER  ${error.message}`);
  }
}

const active = detectProvider(env, providers);
console.log('');
console.log(`  Aktiv: ${active ? `${active.label} · ${active.model}` : 'keiner — LOKAL'}`);
if (!ready) {
  console.log('');
  console.log('  Anleitung: website/.env.example nach website/.env kopieren,');
  console.log('  einen Schlüssel eintragen, Brücke neu starten.');
}
console.log('');
