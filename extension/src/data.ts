// Saving and loading: jobs, candidates and notes in chrome.storage.local (this computer only), plus settings.
// Every view reads the same in-memory state and calls commit() after a change, so all tabs stay in sync.
import { emptyState, normalize, purgeExpired, type State } from './store.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  serverUrl: string;
  appToken: string;
  language: string;
  theme: Theme;
  retentionDays: number;
}

export const SETTINGS_DEFAULTS: Settings = {
  serverUrl: 'http://localhost:8789', // same port as the server's default and manifest.json's host_permissions
  appToken: '',
  language: 'en',
  theme: 'system',
  retentionDays: 90,
};

const DATA_KEY = 'debriefData';
const SETTINGS_KEY = 'debriefSettings';

let state: State = emptyState();
let settings: Settings = { ...SETTINGS_DEFAULTS };
const listeners = new Set<(state: State) => void>();

export const getState = (): State => state;
export const getSettings = (): Settings => settings;

// Runs fn(state) on every change. Returns an unsubscribe function.
export function subscribe(fn: (state: State) => void): () => boolean {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function load(): Promise<{ removed: number }> {
  const saved = await chrome.storage.local.get({ [DATA_KEY]: null, [SETTINGS_KEY]: null });
  settings = { ...SETTINGS_DEFAULTS, ...((saved[SETTINGS_KEY] as Partial<Settings> | null) || {}) };
  state = normalize(saved[DATA_KEY]);
  // Retention: remove candidates nobody has touched for longer than the setting.
  const { state: kept, removed } = purgeExpired(state, Number(settings.retentionDays) || 0);
  if (removed) {
    state = kept;
    await chrome.storage.local.set({ [DATA_KEY]: state });
  }
  return { removed };
}

// Saves the new state and tells every view. quiet = save without redrawing (e.g. while typing notes).
export async function commit(next: State, { quiet = false }: { quiet?: boolean } = {}): Promise<void> {
  state = next;
  await chrome.storage.local.set({ [DATA_KEY]: state });
  if (!quiet) listeners.forEach((fn) => fn(state));
}

export async function saveSettings(changes: Partial<Settings>): Promise<Settings> {
  settings = { ...settings, ...changes };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

export async function deleteAll(): Promise<void> {
  state = emptyState();
  await chrome.storage.local.remove(DATA_KEY);
  listeners.forEach((fn) => fn(state));
}

// Debounced quiet save, for text typed into notes.
let timer: ReturnType<typeof setTimeout> | undefined;
export function commitSoon(next: State): void {
  state = next;
  clearTimeout(timer);
  timer = setTimeout(() => chrome.storage.local.set({ [DATA_KEY]: state }), 400);
}
