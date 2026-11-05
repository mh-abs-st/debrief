// Errors: people see a short, friendly message; the technical reason and how to fix it go to the server log.
//   [ai] 403 forbidden: Request not allowed → The provider is blocking this server's network (VPN, proxy, …)

const NETWORK = /connection error|fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network/i;

export const MESSAGES = {
  offline: 'We couldn’t connect just now. Please check your internet connection and try again.',
  slow: 'This is taking longer than usual. Please try again.',
  unavailable: 'The assistant isn’t available right now. Please try again in a few minutes.',
  busy: 'We’re a little busy right now. Please try again in a few seconds.',
  generic: 'Something went wrong on our side. Please try again.',
  request: 'Something went wrong with this request. Please try again.',
};

// What we read from anything thrown: an Error, a provider error with a status, or a plain value.
export interface ErrorLike {
  name?: string;
  message?: string;
  stack?: string;
  status?: number;
  error?: { type?: string; error?: { type?: string } };
  raw?: string;
  hint?: string;
  friendly?: boolean;
  local?: boolean;
}

// An Error carrying an HTTP status, as thrown by the Anthropic and Deepgram clients.
export type StatusError = Error & { status?: number };

// The error friendlyAiError() returns: safe message for people, details for code and logs.
export type FriendlyError = Error & { status?: number; raw: string; hint: string; friendly: true };

export const asErrorLike = (err: unknown): ErrorLike => (err && typeof err === 'object' ? (err as ErrorLike) : {});

// { message (for people), hint (for the log) } for an error from the Anthropic API.
export function describeAiError(err: unknown): { message: string; hint: string } {
  const e = asErrorLike(err);
  const status = e.status;
  const raw = String(e.message || err || '');
  const type = e.error?.error?.type || e.error?.type || (raw.match(/"type":"(\w+)"/g) || []).map((m) => m.slice(8, -1)).pop() || '';
  if (e.name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(raw)) return { message: MESSAGES.slow, hint: 'The request to Anthropic timed out.' };
  if (!status && NETWORK.test(raw)) return { message: MESSAGES.offline, hint: 'The server could not reach api.anthropic.com: its internet connection or DNS is down.' };
  if (status === 401) return { message: MESSAGES.unavailable, hint: 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY and restart the server.' };
  if (status === 403)
    return {
      message: MESSAGES.unavailable,
      hint: 'Anthropic refused this server’s network (403 Request not allowed), not the key: usually a VPN, proxy, firewall, captive Wi-Fi page or an unsupported region. Switch networks or turn off the VPN/proxy.',
    };
  if (status === 429) return { message: MESSAGES.busy, hint: 'Anthropic rate limit reached. Requests will succeed again shortly; raise limits in the Anthropic console if this is frequent.' };
  if (status === 529 || type === 'overloaded_error') return { message: MESSAGES.busy, hint: 'Anthropic is overloaded (529). Temporary.' };
  if (/credit balance|billing/i.test(raw)) return { message: MESSAGES.unavailable, hint: 'The Anthropic account is out of credit. Add credit at console.anthropic.com → Billing.' };
  if (status === 404) return { message: MESSAGES.unavailable, hint: 'Model not found: check ASSIST_MODEL / FAST_MODEL.' };
  if (status && status >= 500) return { message: MESSAGES.generic, hint: `Anthropic server error (${status}). Temporary.` };
  if (!status) return { message: MESSAGES.generic, hint: 'Unexpected error in the server, not from Anthropic (stack below).' };
  return { message: MESSAGES.request, hint: `Anthropic rejected the request (${status}${type ? ` ${type}` : ''}); see the raw error.` };
}

// The error to throw: friendly message for people, with status and raw details kept for code and logs.
export function friendlyAiError(err: unknown): FriendlyError {
  const e = asErrorLike(err);
  if (e.friendly) return err as FriendlyError;
  const { message, hint } = describeAiError(err);
  return Object.assign(new Error(message), { status: e.status, raw: String(e.message || err || ''), hint, friendly: true as const });
}

// What to send to people from a catch block. Anything that isn't already friendly is logged with its
// stack and replaced by the fallback.
export function userMessage(err: unknown, fallback: string = MESSAGES.generic): string {
  const e = asErrorLike(err);
  if (e.friendly) return e.message || fallback;
  console.error('[error]', e.stack || err);
  return fallback;
}

// Speech-to-text: friendly message for people; technical reason logged.
export function friendlySpeechError(err: unknown): string {
  const raw = String(asErrorLike(err).message || err || '');
  const hint = /\b401\b/.test(raw)
    ? 'Deepgram rejected the API key. Check DEEPGRAM_API_KEY.'
    : /\b402\b/.test(raw)
      ? 'The Deepgram account is out of credit.'
      : /\b403\b/.test(raw)
        ? 'Deepgram refused the connection (403): VPN/proxy/firewall on the server’s network, or the key lacks permission.'
        : NETWORK.test(raw)
          ? 'The server could not reach api.deepgram.com.'
          : 'Unexpected Deepgram error.';
  console.error(`[deepgram] ${raw.slice(0, 300)}\n     → ${hint}`);
  return NETWORK.test(raw) ? 'Transcription lost its connection. Please check your internet and start again.' : 'Transcription isn’t available right now. Please try again in a few minutes.';
}
