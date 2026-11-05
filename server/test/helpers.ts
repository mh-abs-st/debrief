// Shared by the route tests: start the app on a random port and read loosely typed JSON replies.
import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type AppOptions } from '../lib/app.ts';
import type { CompleteArgs } from '../lib/claude.ts';

export const TOKEN = 'test-token';
export const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// Replies in tests are checked field by field, so `any` keeps them short.
export const json = (res: Response): Promise<any> => res.json();

export async function listen(server: http.Server): Promise<{ base: string; close: () => Promise<void> }> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface StartOptions {
  reply?: string | ((args: CompleteArgs) => string);
  fail?: unknown;
  appToken?: string;
  models: AppOptions['models'];
  grantKey?: AppOptions['grantKey'];
}

// Starts the app with a fake AI. Returns its base URL, the calls it made to the AI, post() and close().
export async function start({ reply = '{}', fail = null, appToken = TOKEN, models, grantKey }: StartOptions) {
  const calls: CompleteArgs[] = [];
  const complete = async (args: CompleteArgs): Promise<string> => {
    calls.push(args);
    if (fail) throw fail;
    return typeof reply === 'function' ? reply(args) : reply;
  };
  const { base, close } = await listen(createApp({ complete, grantKey, appToken, models }));
  const post = (path: string, body: unknown, headers: Record<string, string> = auth) =>
    fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { base, calls, post, close };
}
