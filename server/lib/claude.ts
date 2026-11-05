// Minimal Anthropic Messages API client using fetch (no SDK, no dependencies).
// Same role as Offro's Anthropic SDK wrapper, kept small until the product needs more.
import type { StatusError } from './aierrors.ts';

export const API_URL = 'https://api.anthropic.com/v1/messages';

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

export interface CompleteArgs {
  model: string;
  system: string;
  // A string, or content blocks (e.g. a PDF document block plus a text block).
  user: string | ContentBlock[];
  maxTokens?: number;
}

// Returns the full text of a single, non-streamed reply.
export type Complete = (args: CompleteArgs) => Promise<string>;

interface MessagesResponse {
  content?: Array<{ type: string; text?: string }>;
}

export function makeClaude({ apiKey, fetchImpl = fetch, timeoutMs = 60_000 }: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs?: number }): Complete {
  return async function complete({ model, system, user, maxTokens = 600 }) {
    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const err: StatusError = new Error(`Anthropic ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    const data = (await res.json()) as MessagesResponse;
    return (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text || '')
      .join('');
  };
}
