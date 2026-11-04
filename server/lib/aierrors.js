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

// { message (for people), hint (for the log), raw } for an Anthropic SDK error.
export function describeAiError(err) {
  const status = err?.status;
  const raw = String(err?.message || err || '');
  const type = err?.error?.error?.type || err?.error?.type || (raw.match(/"type":"(\w+)"/g) || []).map((m) => m.slice(8, -1)).pop() || '';
  if (err?.name === 'APIConnectionTimeoutError' || /timed? ?out/i.test(raw)) return { message: MESSAGES.slow, hint: 'The request to Anthropic timed out.' };
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
  if (status >= 500) return { message: MESSAGES.generic, hint: `Anthropic server error (${status}). Temporary.` };
  if (!status) return { message: MESSAGES.generic, hint: 'Unexpected error in the server, not from Anthropic (stack below).' };
  return { message: MESSAGES.request, hint: `Anthropic rejected the request (${status}${type ? ` ${type}` : ''}); see the raw error.` };
}

// The error to throw: friendly message for people, with status and raw details kept for code and logs.
export function friendlyAiError(err) {
  if (err?.friendly) return err;
  const { message, hint } = describeAiError(err);
  return Object.assign(new Error(message), { status: err?.status, raw: String(err?.message || err || ''), hint, friendly: true });
}

// What to send to people from a catch block. Anything that isn't already friendly is logged with its
// stack and replaced by the fallback.
export function userMessage(err, fallback = MESSAGES.generic) {
  if (err?.friendly) return err.message;
  console.error('[error]', err?.stack || err);
  return fallback;
}

// Cancelled on purpose (the panel dropped an answer it no longer needs): not an error.
export const isAbort = (err) => err?.name === 'APIUserAbortError' || err?.name === 'AbortError' || /request was aborted/i.test(err?.message || '');
// Rejections the code handles itself (callTool falls back when forced tool_choice isn't supported): don't log.
const expected = (err) => err?.status === 400 && /tool_choice/i.test(err?.message || '');

function logAndMap(err) {
  if (isAbort(err)) return err;
  const mapped = friendlyAiError(err);
  if (!expected(err)) {
    const where = err?.status ? `${err.status}` : err?.name || 'error';
    console.error(`[ai] ${where}: ${mapped.raw.slice(0, 300)}\n     → ${mapped.hint}${err?.status ? '' : `\n${err?.stack || ''}`}`);
  }
  return mapped;
}

// A thin wrapper around the Anthropic client: same create()/stream() calls for our code, with friendly
// errors and logging. It wraps from the outside and never patches the SDK, whose own stream() relies on
// its internal create().
export function wrapAnthropic(client) {
  return {
    client,
    messages: {
      async create(...args) {
        try {
          return await client.messages.create(...args);
        } catch (err) {
          throw logAndMap(err);
        }
      },
      stream(...args) {
        const s = client.messages.stream(...args);
        s.on?.('error', () => {}); // errors are reported once, through finalMessage()
        const facade = {
          on(event, fn) {
            s.on(event, fn);
            return facade;
          },
          abort: () => s.abort(),
          async finalMessage() {
            try {
              return await s.finalMessage();
            } catch (err) {
              throw logAndMap(err);
            }
          },
        };
        return facade;
      },
    },
  };
}

// Speech-to-text: friendly message for people; technical reason logged.
export function friendlySpeechError(err) {
  const raw = String(err?.message || err || '');
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
