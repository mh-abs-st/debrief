import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGrantKey, GRANT_URL } from '../lib/deepgram.js';

test('asks Deepgram for a short-lived key with the main key kept on the server', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ access_token: 'temp', expires_in: 60 }), { status: 200 });
  };
  const grantKey = makeGrantKey({ apiKey: 'main-secret', fetchImpl });
  const out = await grantKey({ ttlSeconds: 60 });
  assert.deepEqual(out, { key: 'temp', expiresIn: 60 });
  assert.equal(seen[0].url, GRANT_URL);
  assert.equal(seen[0].init.headers.Authorization, 'Token main-secret');
  assert.equal(JSON.parse(seen[0].init.body).ttl_seconds, 60);
});

test('Deepgram errors carry the status and no key is returned', async () => {
  const fetchImpl = async () => new Response('nope', { status: 401 });
  const grantKey = makeGrantKey({ apiKey: 'bad', fetchImpl });
  await assert.rejects(grantKey(), (err) => err.status === 401);
});
