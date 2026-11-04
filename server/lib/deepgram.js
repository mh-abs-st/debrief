// Speech-to-text access for the browser. The browser sends audio straight to Deepgram, so Debrief's server
// never sees or stores call audio. The server only hands out a short-lived key, so the main key stays secret.

export const GRANT_URL = 'https://api.deepgram.com/v1/auth/grant';
export const DEFAULT_TTL_SECONDS = 60;

// Returns { key, expiresIn } for one listening session. The key is only valid for ttlSeconds.
export function makeGrantKey({ apiKey, fetchImpl = fetch, timeoutMs = 10_000 }) {
  return async function grantKey({ ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
    const res = await fetchImpl(GRANT_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: ttlSeconds }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const err = new Error(`Deepgram ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Deepgram returned no key');
    return { key: data.access_token, expiresIn: Number(data.expires_in) || ttlSeconds };
  };
}
