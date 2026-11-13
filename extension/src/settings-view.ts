// Settings sheet: server connection, transcription language, theme, how long candidate data is kept,
// backing up and restoring, and deleting everything.
import { $, el, toast, openSheet, confirmSheet, closestTarget, formatDate, type Nav } from './ui.ts';
import { getSettings, saveSettings, deleteAll, getState, commit, type Theme } from './data.ts';
import * as S from './store.ts';
import { listeningCandidate, stoppedNote } from './interview-view.ts';

const input = (id: string) => $<HTMLInputElement>(id);
const select = (id: string) => $<HTMLSelectElement>(id);
const sheet = () => $<HTMLDialogElement>('settingsSheet');

export function initSettings(nav: Nav): void {
  $('openSettings').addEventListener('click', open);
  $('setSave').addEventListener('click', save);
  $('setTheme').addEventListener('click', (e) => {
    const btn = closestTarget(e, '[data-v]');
    if (!btn) return;
    markTheme(btn.dataset.v || 'system');
  });
  $('setDeleteAll').addEventListener('click', removeEverything);
  $('setBackup').addEventListener('click', downloadBackup);
  input('setRestoreFile').addEventListener('change', restoreBackup);
  $('setDemo').addEventListener('click', () => {
    sheet().close();
    nav.demo();
  });
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
  const saved = await saveSettings({
    serverUrl: server,
    appToken: input('setToken').value.trim(),
    language: select('setLanguage').value,
    retentionDays: Number(select('setRetention').value) || 0,
    theme,
  });
  applyTheme(theme);
  if (!saved) return; // the error is on screen; the sheet stays open to try again
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
  const listened = listeningCandidate();
  const ok = await confirmSheet({
    title: 'Delete all data?',
    body:
      `This deletes ${jobs.length} job${jobs.length === 1 ? '' : 's'} and ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}, with their resumes, plans and notes, from this computer. Your settings stay. This can’t be undone.` +
      (listened ? ' Debrief stops listening to the call.' : ''),
    yes: 'Delete everything',
  });
  if (!ok) return;
  if (!(await deleteAll())) {
    return toast('We couldn’t delete your data. Close and reopen Debrief, then try again.', { error: true });
  }
  sheet().close();
  toast('All jobs, candidates and notes deleted.' + stoppedNote(listened));
}

// ---------- Backup and restore ----------

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function downloadBackup() {
  const state = getState();
  if (!state.jobs.length) return toast('Nothing to back up yet. Add a job first.');
  const blob = new Blob([JSON.stringify(S.makeBackup(state), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: S.backupFileName() });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  toast(`Backup downloaded: ${plural(state.jobs.length, 'job')} and ${plural(state.candidates.length, 'candidate')}. It contains candidate data, so keep it somewhere safe.`);
}

async function restoreBackup() {
  const fileInput = input('setRestoreFile');
  const file = fileInput.files?.[0];
  fileInput.value = ''; // choosing the same file again still works
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return toast('That file is too big to be a Debrief backup.', { error: true });
  const read = S.readBackup(await file.text());
  if ('error' in read) return toast(read.error, { error: true });

  const now = getState();
  const listened = listeningCandidate();
  const from = read.exportedAt ? ` from ${formatDate(read.exportedAt)}` : '';
  const ok = await confirmSheet({
    title: 'Replace your data with this backup?',
    body:
      `The backup${from} has ${plural(read.state.jobs.length, 'job')} and ${plural(read.state.candidates.length, 'candidate')}. ` +
      `It replaces the ${plural(now.jobs.length, 'job')} and ${plural(now.candidates.length, 'candidate')} on this computer, with their notes. Your settings stay.` +
      (listened ? ' Debrief stops listening if that candidate isn’t in the backup.' : ''),
    yes: 'Replace my data',
    no: 'Cancel',
  });
  if (!ok) return;

  // The retention setting applies to restored data too.
  const { state, removed } = S.purgeExpired(read.state, getSettings().retentionDays);
  if (!(await commit(state))) return; // the save error is on screen; nothing was replaced on disk
  sheet().close();
  const notes = [
    `Restored ${plural(state.jobs.length, 'job')} and ${plural(state.candidates.length, 'candidate')}.`,
    removed ? `${plural(removed, 'candidate')} older than your Settings allow ${removed === 1 ? 'was' : 'were'} removed.` : '',
    read.skipped ? `${read.skipped} damaged ${read.skipped === 1 ? 'entry' : 'entries'} skipped.` : '',
  ];
  toast(notes.filter(Boolean).join(' ') + stoppedNote(listened));
}
