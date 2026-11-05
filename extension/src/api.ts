// Calls to the Debrief server. Errors come back as short, friendly messages for the panel.
import { getSettings } from './data.ts';
import type { Plan, Skill } from './store.ts';

// What each server route replies with (see server/lib/app.ts).
export interface ApiReplies {
  '/api/skills': { skills: Skill[] };
  '/api/followups': { questions: string[] };
  '/api/plan': { plan: Plan };
  '/api/resume/parse': { text: string };
  '/api/transcribe-token': { key: string; expiresIn: number };
}

export async function api<P extends keyof ApiReplies>(path: P, body: object = {}): Promise<ApiReplies[P]> {
  const { serverUrl, appToken } = getSettings();
  if (!appToken) throw new Error('Add the app token in Settings first.');
  let res: Response;
  try {
    res = await fetch(`${String(serverUrl).replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('We couldn’t reach the server. Check the server address in Settings.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data as ApiReplies[P];
}
