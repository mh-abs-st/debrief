// Speech-to-text access for the browser. The browser sends audio straight to Deepgram, so Debrief's server
// never sees or stores call audio. The server only hands out a short-lived key, so the main key stays secret.
import type { StatusError } from './aierrors.ts';

export const GRANT_URL = 'https://api.deepgram.com/v1/auth/grant';
export const DEFAULT_TTL_SECONDS = 60;

export interface Grant {
  key: string;
  expiresIn: number;
}

export type GrantKey = (opts?: { ttlSeconds?: number }) => Promise<Grant>;

// Returns { key, expiresIn } for one listening session. The key is only valid for ttlSeconds.
export function makeGrantKey({ apiKey, fetchImpl = fetch, timeoutMs = 10_000 }: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): GrantKey {
  return async function grantKey({ ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
    const res = await fetchImpl(GRANT_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl_seconds: ttlSeconds }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const err: StatusError = new Error(`Deepgram ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('Deepgram returned no key');
    return { key: data.access_token, expiresIn: Number(data.expires_in) || ttlSeconds };
  };
}
