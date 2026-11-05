// Settings sheet: server connection, transcription language, theme, how long candidate data is kept,
// and deleting everything.
import { $, toast, openSheet, confirmSheet } from './ui.js';
import { getSettings, saveSettings, deleteAll, getState } from './data.js';

export function initSettings() {
  $('openSettings').addEventListener('click', open);
  $('setSave').addEventListener('click', save);
  $('setTheme').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-v]');
    if (!btn) return;
    markTheme(btn.dataset.v);
  });
  $('setDeleteAll').addEventListener('click', removeEverything);
}

function open() {
  const s = getSettings();
  $('setServer').value = s.serverUrl;
  $('setToken').value = s.appToken;
  $('setLanguage').value = s.language;
  $('setRetention').value = String(s.retentionDays);
  markTheme(s.theme);
  openSheet('settingsSheet');
}

function markTheme(value) {
  $('setTheme').querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === value)));
}

async function save() {
  const server = $('setServer').value.trim().replace(/\/+$/, '');
  if (server && !/^https?:\/\//.test(server)) return toast('The server address should start with https:// (or http://localhost).', { error: true });
  const theme = $('setTheme').querySelector('[aria-checked="true"]')?.dataset.v || 'system';
  await saveSettings({
    serverUrl: server,
    appToken: $('setToken').value.trim(),
    language: $('setLanguage').value,
    retentionDays: Number($('setRetention').value) || 0,
    theme,
  });
  applyTheme(theme);
  $('settingsSheet').close();
  toast('Settings saved.');
}

// Theme on <html>; also kept in localStorage so theme-init.js can set it before the page draws.
export function applyTheme(theme) {
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
  $('settingsSheet').close();
  toast('All jobs, candidates and notes deleted.');
}
