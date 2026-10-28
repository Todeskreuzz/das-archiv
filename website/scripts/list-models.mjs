import { loadEnv, loadProviders, listProviders } from './providers.mjs';

/**
 * Fragt bei jedem eingerichteten Anbieter die Modellliste ab.
 * Gibt nur Modellnamen aus, niemals Schluessel.
 */

const env = { ...loadEnv(), ...process.env };
const providers = loadProviders();
const list = listProviders(env, providers);

const interesting = {
  gemini: /flash|pro/i,
  groq: /llama|gpt-oss|qwen|mixtral|deepseek/i,
  openrouter: /free/i,
  cloudflare: /llama|qwen|mistral/i,
};

for (const provider of list) {
  if (!provider.ready) {
    console.log(`○ ${provider.label}: kein Schluessel`);
    continue;
  }

  try {
    const response = await fetch(`${provider.baseUrl.replace(/\/$/, '')}/models`, {
      headers: { authorization: `Bearer ${provider.key}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(`× ${provider.label}: HTTP ${response.status}`);
      continue;
    }

    const data = await response.json();
    const models = (data.data || data.models || [])
      .map((entry) => (typeof entry === 'string' ? entry : entry.id || entry.name))
      .filter(Boolean);

    const filter = interesting[provider.id] || /.*/;
    const hits = models.filter((model) => filter.test(model)).slice(0, 25);

    console.log('');
    console.log(`● ${provider.label} — ${models.length} Modelle, Vorschläge:`);
    for (const model of hits) console.log(`   ${model}`);
  } catch (error) {
    console.log(`× ${provider.label}: ${error.message}`);
  }
}
