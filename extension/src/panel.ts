// Side panel entry: loads saved data, wires the four tabs (Live, Prepare, Jobs, Demo) and Settings.
import { $, toast, closestTarget, type GoTo, type Tab } from './ui.ts';
import { load, getSettings } from './data.ts';
import { initJobs, showJob, addJob, addCandidateTo } from './jobs-view.ts';
import { initPrepare, selectForPrepare } from './prepare-view.ts';
import { initLive, selectForLive, isListening } from './live-view.ts';
import { initDemo, stopDemo } from './demo-view.ts';
import { initSettings, applyTheme } from './settings-view.ts';

const TABS: Tab[] = ['live', 'prepare', 'jobs', 'demo'];
const isTab = (value: unknown): value is Tab => TABS.includes(value as Tab);

function showTab(name: Tab) {
  for (const t of TABS) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`view-${t}`).hidden = t !== name;
  }
  if (name !== 'demo') stopDemo();
  try {
    localStorage.setItem('debriefTab', name);
  } catch {}
}

// Moves between tabs with a job or candidate already chosen (e.g. Jobs → "Prepare" on a candidate).
const goTo: GoTo = (tab, { jobId, candidateId, addCandidate } = {}) => {
  if (tab === 'jobs') {
    if (jobId) showJob(jobId);
    else showJob(null);
    showTab('jobs');
    if (jobId && addCandidate) addCandidateTo(jobId);
    else if (!jobId) addJob();
    return;
  }
  if (tab === 'prepare') selectForPrepare(jobId, candidateId);
  if (tab === 'live') selectForLive(jobId, candidateId);
  showTab(tab);
};

async function main() {
  const { removed } = await load();
  applyTheme(getSettings().theme);

  initSettings();
  initJobs({ onGo: goTo });
  initPrepare({ onGo: goTo });
  initLive({ onGo: goTo });
  initDemo();

  $('tabs').addEventListener('click', (e) => {
    const tab = closestTarget(e, '[role="tab"]')?.dataset.tab;
    if (isTab(tab)) showTab(tab);
  });
  // Arrow keys move between tabs, as for any tab list.
  $('tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => $(`tab-${t}`).getAttribute('aria-selected') === 'true');
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    showTab(next);
    $(`tab-${next}`).focus();
  });

  let first: string | null = 'live';
  try {
    first = localStorage.getItem('debriefTab');
  } catch {}
  showTab(isTab(first) ? first : 'live');

  if (removed) toast(`${removed} candidate${removed === 1 ? '' : 's'} removed: not changed for longer than your Settings allow.`);
  if (!getSettings().appToken) toast('Add the server address and app token in Settings to use AI features.');

  // Closing the panel stops listening (the browser ends the audio anyway); say so if it was on.
  window.addEventListener('beforeunload', (e) => {
    if (isListening()) e.preventDefault();
  });
}

main().catch((err) => {
  console.error('[debrief] could not start', err);
  toast('Debrief couldn’t start. Close and reopen the panel.', { error: true });
});
