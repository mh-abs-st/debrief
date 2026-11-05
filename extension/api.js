// Calls to the Debrief server. Errors come back as short, friendly messages for the panel.
import { getSettings } from './data.js';

export async function api(path, body = {}) {
  const { serverUrl, appToken } = getSettings();
  if (!appToken) throw new Error('Add the app token in Settings first.');
  let res;
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
  return data;
}
