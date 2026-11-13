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
  includeMic: boolean; // mix in the interviewer's microphone and label lines You and Them
}

export const SETTINGS_DEFAULTS: Settings = {
  serverUrl: 'http://localhost:8789', // the development server; npm run package swaps in the production one
  appToken: '',
  language: 'en',
  theme: 'system',
  retentionDays: 90,
  includeMic: false,
};

const DATA_KEY = 'debriefData';
const SETTINGS_KEY = 'debriefSettings';

let state: State = emptyState();
let settings: Settings = { ...SETTINGS_DEFAULTS };
const listeners = new Set<(state: State) => void>();
let timer: ReturnType<typeof setTimeout> | undefined; // pending commitSoon() save

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
    await write(); // if this fails they're removed again next time
  }
  return { removed };
}

// What to say when a save fails. The change stays in memory (so the panel still shows it) but isn't stored.
export function saveErrorMessage(err: unknown): string {
  const full = /quota/i.test(String((err as Error)?.message ?? err));
  return full
    ? 'We couldn’t save that: Chrome’s storage for Debrief is full. Delete old candidates you no longer need, then try again.'
    : 'We couldn’t save that. It’s on screen but will be lost when you close the panel. Check your computer has free disk space, then try again.';
}

// Runs when a save fails. panel.ts shows it as an error toast; until then, log it.
let reportSaveError: (err: unknown) => void = (err) => console.error('[debrief] save failed', err);
export function onSaveError(fn: (err: unknown) => void): void {
  reportSaveError = fn;
}

// Saves the new state and tells every view. quiet = save without redrawing (e.g. while typing notes).
// Never throws: a failed save is reported through onSaveError and returns false, so callers only say
// "saved" when it was. Views still redraw, since the change is in memory either way, and the next
// save that works stores it too.
export async function commit(next: State, { quiet = false }: { quiet?: boolean } = {}): Promise<boolean> {
  state = next;
  clearTimeout(timer); // this save includes anything typed since
  timer = undefined;
  const saved = await write();
  if (!quiet) listeners.forEach((fn) => fn(state));
  return saved;
}

async function write(): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [DATA_KEY]: state });
    return true;
  } catch (err) {
    reportSaveError(err);
    return false;
  }
}

// Returns false if the settings couldn't be stored (reported like any failed save).
export async function saveSettings(changes: Partial<Settings>): Promise<boolean> {
  settings = { ...settings, ...changes };
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    return true;
  } catch (err) {
    reportSaveError(err);
    return false;
  }
}

// Returns false if the stored data couldn't be removed. The caller says so: the data would come back
// next time, so the usual "will be lost" message would be wrong.
export async function deleteAll(): Promise<boolean> {
  clearTimeout(timer);
  timer = undefined;
  let removed = true;
  try {
    await chrome.storage.local.remove(DATA_KEY);
  } catch (err) {
    console.error('[debrief] delete failed', err);
    removed = false;
  }
  if (removed) state = emptyState();
  listeners.forEach((fn) => fn(state));
  return removed;
}

// Debounced quiet save, for text typed into notes. Failures are reported like any save.
export function commitSoon(next: State): void {
  state = next;
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void write();
  }, 400);
}

// Saves what commitSoon() is still holding back, right now: for when the panel closes or is hidden,
// or a notes field loses focus. True when nothing was waiting or the save worked; failures are
// reported like any save.
export function savePendingNow(): Promise<boolean> {
  if (timer === undefined) return Promise.resolve(true);
  clearTimeout(timer);
  timer = undefined;
  return write();
}
