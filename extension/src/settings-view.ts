// Settings sheet: server connection, transcription language, theme, how long candidate data is kept,
// and deleting everything.
import { $, toast, openSheet, confirmSheet, closestTarget } from './ui.ts';
import { getSettings, saveSettings, deleteAll, getState, type Theme } from './data.ts';

const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const sheet = () => $<HTMLDialogElement>('settingsSheet');

export function initSettings(): void {
  $('openSettings').addEventListener('click', open);
  $('setSave').addEventListener('click', save);
  $('setTheme').addEventListener('click', (e) => {
    const btn = closestTarget(e, '[data-v]');
    if (!btn) return;
    markTheme(btn.dataset.v || 'system');
  });
  $('setDeleteAll').addEventListener('click', removeEverything);
}

function open() {
  const s = getSettings();
  input('setServer').value = s.serverUrl;
  input('setToken').value = s.appToken;
  select('setLanguage').value = s.language;
  select('setRetention').value = String(s.retentionDays);
  markTheme(s.theme);
  openSheet('settingsSheet');
}

function markTheme(value: string) {
  $('setTheme')
    .querySelectorAll<HTMLElement>('[data-v]')
    .forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === value)));
}

const asTheme = (value: string | undefined): Theme => (value === 'light' || value === 'dark' ? value : 'system');

async function save() {
  const server = input('setServer').value.trim().replace(/\/+$/, '');
  if (server && !/^https?:\/\//.test(server)) return toast('The server address should start with https:// (or http://localhost).', { error: true });
  const theme = asTheme($('setTheme').querySelector<HTMLElement>('[aria-checked="true"]')?.dataset.v);
  await saveSettings({
    serverUrl: server,
    appToken: input('setToken').value.trim(),
    language: select('setLanguage').value,
    retentionDays: Number(select('setRetention').value) || 0,
    theme,
  });
  applyTheme(theme);
  sheet().close();
  toast('Settings saved.');
}

// Theme on <html>; also kept in localStorage so theme-init.js can set it before the page draws.
export function applyTheme(theme: Theme): void {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('debriefTheme', theme);
  } catch {}
}

async function removeEverything() {
  const { jobs, candidates } = getState();
  const ok = await confirmSheet({
    title: 'Delete all data?',
    body: `This deletes ${jobs.length} job${jobs.length === 1 ? '' : 's'} and ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}, with their resumes, plans and notes, from this computer. Your settings stay. This can’t be undone.`,
    yes: 'Delete everything',
  });
  if (!ok) return;
  await deleteAll();
  sheet().close();
  toast('All jobs, candidates and notes deleted.');
}
