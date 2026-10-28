import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadEnv,
  loadProviders,
  resolveProvider,
  listProviders,
  detectProvider,
  customProvider,
  chat,
} from '../scripts/providers.mjs';

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://example.invalid/v1beta/openai',
    model: 'gemini-test',
    keyEnv: 'GEMINI_API_KEY',
  },
  cloudflare: {
    label: 'Cloudflare',
    baseUrl: 'https://example.invalid/accounts/{account}/ai/v1',
    model: '@cf/test',
    keyEnv: 'CLOUDFLARE_API_TOKEN',
    accountEnv: 'CLOUDFLARE_ACCOUNT_ID',
  },
};

test('loadEnv liest Kommentare, Anführungszeichen und Leerzeilen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'archiv-env-'));
  const file = join(dir, '.env');
  writeFileSync(
    file,
    ['# Kommentar', '', 'GEMINI_API_KEY="abc123"', "GROQ_API_KEY='xyz'", 'LEER='].join('\n'),
    'utf8',
  );

  const env = loadEnv(file);
  assert.equal(env.GEMINI_API_KEY, 'abc123');
  assert.equal(env.GROQ_API_KEY, 'xyz');
  assert.equal(env.LEER, '');
});

test('loadEnv ohne Datei gibt ein leeres Objekt', () => {
  assert.deepEqual(loadEnv(join(tmpdir(), 'gibt-es-nicht-'.concat(String(Date.now()), '.env'))), {});
});

test('Anbieter ohne Schlüssel ist nicht bereit', () => {
  const provider = resolveProvider('gemini', {}, PROVIDERS);
  assert.equal(provider.ready, false);
  assert.equal(provider.model, 'gemini-test');
});

test('Anbieter mit Schlüssel ist bereit', () => {
  const provider = resolveProvider('gemini', { GEMINI_API_KEY: 'k' }, PROVIDERS);
  assert.equal(provider.ready, true);
});

test('Cloudflare braucht Konto-ID und Token', () => {
  const ohneKonto = resolveProvider('cloudflare', { CLOUDFLARE_API_TOKEN: 't' }, PROVIDERS);
  assert.equal(ohneKonto.ready, false);

  const mitKonto = resolveProvider(
    'cloudflare',
    { CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ACCOUNT_ID: 'abc' },
    PROVIDERS,
  );
  assert.equal(mitKonto.ready, true);
  assert.ok(mitKonto.baseUrl.includes('/accounts/abc/'));
});

test('ARCHIV_MODEL überschreibt das Standardmodell', () => {
  const provider = resolveProvider('gemini', { GEMINI_API_KEY: 'k', ARCHIV_MODEL: 'eigenes' }, PROVIDERS);
  assert.equal(provider.model, 'eigenes');
});

test('ARCHIV_PROVIDER wählt den Anbieter aus', () => {
  const env = { GEMINI_API_KEY: 'a', CLOUDFLARE_API_TOKEN: 'b', CLOUDFLARE_ACCOUNT_ID: 'c', ARCHIV_PROVIDER: 'cloudflare' };
  assert.equal(detectProvider(env, PROVIDERS).id, 'cloudflare');
});

test('ohne Angabe gewinnt der erste eingerichtete Anbieter', () => {
  const env = { GEMINI_API_KEY: 'a' };
  assert.equal(detectProvider(env, PROVIDERS).id, 'gemini');
});

test('ohne Schlüssel gibt es keinen Anbieter', () => {
  assert.equal(detectProvider({}, PROVIDERS), null);
  assert.equal(customProvider({}), null);
});

test('eigener Endpunkt über ARCHIV_API_KEY', () => {
  const provider = customProvider({ ARCHIV_API_KEY: 'k', ARCHIV_BASE_URL: 'http://localhost:11434/v1' });
  assert.equal(provider.ready, true);
  assert.equal(provider.model, 'gpt-4o-mini');
});

test('listProviders gibt alle vier zurück', () => {
  const list = listProviders({}, PROVIDERS);
  assert.equal(list.length, 2);
  assert.ok(list.every((entry) => entry.ready === false));
});

test('chat schickt Modell und Schlüssel und liest die Antwort', async () => {
  let captured = null;
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      captured = {
        url: req.url,
        auth: req.headers.authorization,
        contentType: req.headers['content-type'],
        json: JSON.parse(body),
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '{"say":"bereit"}' } }] }));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const provider = {
    id: 'test',
    label: 'Test',
    baseUrl: `http://127.0.0.1:${port}/v1`,
    model: 'test-modell',
    key: 'geheim',
    ready: true,
  };

  const answer = await chat(provider, [{ role: 'user', content: 'hallo' }], { maxTokens: 10 });
  server.close();

  assert.equal(answer, '{"say":"bereit"}');
  assert.equal(captured.url, '/v1/chat/completions');
  assert.equal(captured.auth, 'Bearer geheim');
  assert.equal(captured.contentType, 'application/json');
  assert.equal(captured.json.model, 'test-modell');
  assert.equal(captured.json.messages[0].content, 'hallo');
});

test('chat meldet HTTP-Fehler verständlich', async () => {
  const server = createServer((req, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end('{"error":"invalid key"}');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const provider = {
    id: 'test',
    label: 'Test',
    baseUrl: `http://127.0.0.1:${port}/v1`,
    model: 'm',
    key: 'k',
    ready: true,
  };

  await assert.rejects(() => chat(provider, [{ role: 'user', content: 'x' }]), /HTTP 401/);
  server.close();
});
