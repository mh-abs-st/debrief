// Side panel entry: loads saved data, wires the tabs (Interview, Upcoming, Jobs), candidate pages, the demo
// and Settings, and remembers where you were so reopening the panel brings you back there.
import { $, toast, closestTarget, type Nav, type Section, type Tab } from './ui.ts';
import { load, getSettings, getState, onSaveError, saveErrorMessage, savePendingNow } from './data.ts';
import { initUpcoming, renderUpcoming } from './upcoming-view.ts';
import { initJobs, showJob, addJob, addCandidateTo, editCandidate } from './jobs-view.ts';
import { initCandidate, showCurrent, showSection, browseCandidate, hideCandidatePage, shownCandidate, shownSection, shownMode, isSection } from './candidate-view.ts';
import { initPlan } from './plan-view.ts';
import { initInterview, isListening } from './interview-view.ts';
import { initDemo, stopDemo } from './demo-view.ts';
import { initSettings, applyTheme } from './settings-view.ts';
import * as S from './store.ts';

const TABS: Tab[] = ['interview', 'upcoming', 'jobs'];
const isTab = (value: unknown): value is Tab => TABS.includes(value as Tab);
type Page = 'interview' | 'upcoming' | 'jobs' | 'person' | 'demo';
const VIEW: Record<Page, string> = { interview: 'view-person', person: 'view-person', upcoming: 'view-upcoming', jobs: 'view-jobs', demo: 'view-demo' };
const SAVED_KEY = 'debriefView';

let tab: Tab = 'interview'; // the highlighted tab; a browsed candidate page and the demo keep the one they came from
let page: Page = 'interview';
let chosen = ''; // the candidate you picked with "Interview … now" (saved)
let justEnded = ''; // after ending an interview, keep showing that candidate's notes until you leave the tab

// Who the Interview tab shows: see S.currentCandidateId.
const current = (): string => S.currentCandidateId(getState(), S.localDateKey(new Date()), justEnded || chosen);

function show(next: Page) {
  page = next;
  for (const view of new Set(Object.values(VIEW))) $(view).hidden = view !== VIEW[next];
  for (const t of TABS) $(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
  if (next !== 'demo') stopDemo();
  if (next !== 'interview') justEnded = '';
  if (next !== 'interview' && next !== 'person') hideCandidatePage();
  window.scrollTo(0, 0);
}

// Where you are, so the panel reopens there (e.g. mid-interview, on the same section).
function remember() {
  const saved = {
    tab,
    chosen,
    section: page === 'interview' ? shownSection() : undefined,
    browsing: page === 'person' && shownMode() === 'browse' ? { id: shownCandidate(), section: shownSection() } : undefined,
  };
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {}
}

function restore() {
  let saved: { tab?: unknown; chosen?: unknown; section?: unknown; browsing?: { id?: unknown; section?: unknown } } = {};
  try {
    saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
    localStorage.removeItem('debriefTab'); // from the old Live/Prepare/Jobs/Demo tabs
  } catch {}
  if (typeof saved.chosen === 'string') chosen = saved.chosen;
  const savedTab = isTab(saved.tab) ? saved.tab : 'interview';
  if (savedTab === 'interview') return nav.tab('interview', isSection(saved.section) ? saved.section : undefined);
  nav.tab(savedTab);
  const b = saved.browsing;
  if (b && typeof b.id === 'string' && S.getCandidate(getState(), b.id)) nav.candidate(b.id, isSection(b.section) ? b.section : undefined);
}

const nav: Nav & { tab(next: Tab, section?: Section): void } = {
  tab(next, section?: Section) {
    tab = next;
    show(next);
    if (next === 'interview') showCurrent(section);
    if (next === 'upcoming') renderUpcoming();
    remember();
  },
  job(jobId) {
    tab = 'jobs';
    showJob(jobId);
    show('jobs');
    remember();
  },
  candidate(candidateId, section?: Section) {
    if (candidateId === current()) return nav.tab('interview', section);
    show('person');
    browseCandidate(candidateId, section, tab === 'interview' ? 'upcoming' : tab);
  },
  interviewWith(candidateId) {
    chosen = candidateId;
    justEnded = '';
    nav.tab('interview', 'interview');
  },
  addJob() {
    nav.tab('jobs');
    showJob(null);
    addJob();
  },
  addCandidate(jobId) {
    nav.job(jobId);
    addCandidateTo(jobId);
  },
  editCandidate(candidateId) {
    editCandidate(candidateId);
  },
  demo() {
    $('demoBackLabel').textContent = tab === 'jobs' ? 'Jobs' : tab === 'upcoming' ? 'Upcoming' : 'Interview';
    show('demo');
  },
};

async function main() {
  onSaveError((err) => toast(saveErrorMessage(err), { error: true }));
  const { removed } = await load();
  applyTheme(getSettings().theme);

  initSettings(nav);
  initUpcoming(nav);
  initJobs(nav);
  initPlan(nav);
  initInterview({
    onEnd: (candidateId) => {
      // The interview is done: you're free to move on, but first see what you wrote.
      justEnded = candidateId;
      chosen = '';
      showSection('notes');
    },
  });
  initCandidate(nav, { current, onChange: remember });
  initDemo({ onBack: () => nav.tab(tab) });

  $('tabs').addEventListener('click', (e) => {
    const next = closestTarget(e, '[role="tab"]')?.dataset.tab;
    if (isTab(next)) nav.tab(next);
  });
  // Arrow keys move between tabs, as for any tab list.
  $('tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const step = e.key === 'ArrowRight' ? 1 : TABS.length - 1;
    const next = TABS[(TABS.indexOf(tab) + step) % TABS.length];
    nav.tab(next);
    $(`tab-${next}`).focus();
  });

  restore();

  if (removed) toast(`${removed} candidate${removed === 1 ? '' : 's'} removed: not changed for longer than your Settings allow.`);
  if (!getSettings().appToken) toast('Add the server address and app token in Settings to use AI features.');

  // Closing the panel stops listening (the browser ends the audio anyway); say so if it was on.
  window.addEventListener('beforeunload', (e) => {
    if (isListening()) e.preventDefault();
  });

  // Notes are saved 400 ms after typing stops. Closing or hiding the panel saves them at once,
  // so the last words typed before closing aren't lost.
  window.addEventListener('pagehide', () => void savePendingNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void savePendingNow();
  });
}

main().catch((err) => {
  console.error('[debrief] could not start', err);
  toast('Debrief couldn’t start. Close and reopen the panel.', { error: true });
});
