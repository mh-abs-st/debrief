// Saving and loading: jobs, candidates and notes in chrome.storage.local (this computer only), plus settings.
// Every view reads the same in-memory state and calls commit() after a change, so all tabs stay in sync.
import { emptyState, normalize, purgeExpired } from './store.js';

export const SETTINGS_DEFAULTS = {
  serverUrl: 'http://localhost:8787',
  appToken: '',
  language: 'en',
  theme: 'system',
  retentionDays: 90,
};

const DATA_KEY = 'debriefData';
const SETTINGS_KEY = 'debriefSettings';

let state = emptyState();
let settings = { ...SETTINGS_DEFAULTS };
const listeners = new Set();

export const getState = () => state;
export const getSettings = () => settings;

// Runs fn(state) on every change. Returns an unsubscribe function.
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function load() {
  const saved = await chrome.storage.local.get({ [DATA_KEY]: null, [SETTINGS_KEY]: null });
  settings = { ...SETTINGS_DEFAULTS, ...(saved[SETTINGS_KEY] || {}) };
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
export async function commit(next, { quiet = false } = {}) {
  state = next;
  await chrome.storage.local.set({ [DATA_KEY]: state });
  if (!quiet) listeners.forEach((fn) => fn(state));
}

export async function saveSettings(changes) {
  settings = { ...settings, ...changes };
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

export async function deleteAll() {
  state = emptyState();
  await chrome.storage.local.remove(DATA_KEY);
  listeners.forEach((fn) => fn(state));
}

// Debounced quiet save, for text typed into notes.
let timer = null;
export function commitSoon(next) {
  state = next;
  clearTimeout(timer);
  timer = setTimeout(() => chrome.storage.local.set({ [DATA_KEY]: state }), 400);
}
