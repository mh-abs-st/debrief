import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGrantKey, GRANT_URL } from '../lib/deepgram.ts';

test('asks Deepgram for a short-lived key with the main key kept on the server', async () => {
  const seen: Array<{ url: string; init: RequestInit & { headers: Record<string, string>; body: string } }> = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init as (typeof seen)[number]['init'] });
    return new Response(JSON.stringify({ access_token: 'temp', expires_in: 60 }), { status: 200 });
  };
  const grantKey = makeGrantKey({ apiKey: 'main-secret', fetchImpl: fetchImpl as typeof fetch });
  const out = await grantKey({ ttlSeconds: 60 });
  assert.deepEqual(out, { key: 'temp', expiresIn: 60 });
  assert.equal(seen[0].url, GRANT_URL);
  assert.equal(seen[0].init.headers.Authorization, 'Token main-secret');
  assert.equal(JSON.parse(seen[0].init.body).ttl_seconds, 60);
});

test('Deepgram errors carry the status and no key is returned', async () => {
  const fetchImpl = async () => new Response('nope', { status: 401 });
  const grantKey = makeGrantKey({ apiKey: 'bad', fetchImpl: fetchImpl as typeof fetch });
  await assert.rejects(grantKey(), (err: { status?: number }) => err.status === 401);
});
