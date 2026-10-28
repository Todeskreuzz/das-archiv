import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Anbieter-Auflösung für die Brücke.
 *
 * Vier kostenlose Cloud-Dienste, alle mit derselben Schnittstelle
 * (POST /chat/completions). Kein SDK, kein Zusatzpaket.
 */

const root = fileURLToPath(new URL('..', import.meta.url));

export function loadEnv(file = join(root, '.env')) {
  if (!existsSync(file)) return {};
  const result = {};
  const text = readFileSync(file, 'utf8');

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }

  return result;
}

export function loadProviders(file = join(root, 'providers.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function resolveProvider(id, env, providers) {
  const config = providers[id];
  if (!config) return null;

  const key = env[config.keyEnv] || '';
  let baseUrl = config.baseUrl || '';
  let missingAccount = false;

  if (config.accountEnv) {
    const account = env[config.accountEnv] || '';
    if (!account) missingAccount = true;
    baseUrl = baseUrl.replace('{account}', account);
  }

  const model = env.ARCHIV_MODEL || config.model;

  return {
    id,
    label: config.label,
    baseUrl,
    model,
    key,
    envKey: config.keyEnv,
    docs: config.docs,
    note: config.note,
    headers: config.headers || {},
    ready: Boolean(key && baseUrl && !baseUrl.includes('{') && !missingAccount),
  };
}

export function listProviders(env, providers) {
  return Object.keys(providers).map((id) => resolveProvider(id, env, providers));
}

/** Freier Endpunkt über ARCHIV_API_KEY (Ollama, LM Studio, eigener Proxy). */
export function customProvider(env) {
  if (!env.ARCHIV_API_KEY) return null;
  return {
    id: 'custom',
    label: 'Eigener Endpunkt',
    baseUrl: env.ARCHIV_BASE_URL || 'https://api.openai.com/v1',
    model: env.ARCHIV_MODEL || 'gpt-4o-mini',
    key: env.ARCHIV_API_KEY,
    envKey: 'ARCHIV_API_KEY',
    docs: '',
    note: 'Aus ARCHIV_* gesetzt.',
    ready: true,
  };
}

export function detectProvider(env, providers) {
  if (env.ARCHIV_PROVIDER) {
    return resolveProvider(env.ARCHIV_PROVIDER, env, providers);
  }
  return listProviders(env, providers).find((provider) => provider.ready) || customProvider(env);
}

export async function chat(provider, messages, options = {}) {
  const { maxTokens = 260, temperature = 0.85, timeout = 25000 } = options;

  if (!provider || !provider.ready) {
    throw new Error(`Anbieter ${provider?.id || '?'} ist nicht eingerichtet`);
  }

  const endpoint = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
  let response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.key}`,
        ...(provider.headers || {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new Error(`${provider.label}: keine Verbindung (${error.message})`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${provider.label}: HTTP ${response.status} ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}
