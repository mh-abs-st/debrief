// A candidate's page: their header, then Plan, Interview and Notes. It has two modes:
// - 'current': the Interview tab. Shows the current candidate (running interview, your choice, or next due).
// - 'browse': opened from Upcoming or Jobs to look at someone else, with Back. Their Interview part offers
//   "Interview … now" instead of the interview itself, so looking around never stops a running transcription.
import { $, el, formatDate, closestTarget, type Nav, type Section, type Tab } from './ui.ts';
import { getState, subscribe } from './data.ts';
import { renderPlanSection } from './plan-view.ts';
import { renderInterviewSection, copy } from './interview-view.ts';
import * as S from './store.ts';

const SECTIONS: Section[] = ['plan', 'interview', 'notes'];
export const isSection = (value: unknown): value is Section => SECTIONS.includes(value as Section);

export type Mode = 'current' | 'browse';

let nav: Nav;
let onChange: () => void = () => {};
let currentId: () => string = () => '';
let mode: Mode = 'current';
let candidateId = '';
let section: Section = 'interview';
let backTo: Tab = 'upcoming';
let visible = false;

export const shownCandidate = (): string => candidateId;
export const shownSection = (): Section => section;
export const shownMode = (): Mode => mode;

// current() says who the Interview tab shows. onChange runs when the shown candidate or section changes
// (panel.ts remembers it for next time).
export function initCandidate(navigation: Nav, options: { current: () => string; onChange: () => void }): void {
  nav = navigation;
  currentId = options.current;
  onChange = options.onChange;
  $('personBack').addEventListener('click', () => nav.tab(backTo));
  $('personEdit').addEventListener('click', () => nav.editCandidate(candidateId));
  $('personSections').addEventListener('click', (e) => {
    const value = closestTarget(e, '[data-section]')?.dataset.section;
    if (isSection(value)) showSection(value);
  });
  // Arrow keys move between sections, as for any tab list.
  $('personSections').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = SECTIONS.indexOf(section);
    const next = SECTIONS[(i + (e.key === 'ArrowRight' ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
    showSection(next);
    $(`sec-${next}`).focus();
  });
  subscribe(() => {
    if (!visible) return;
    if (mode === 'current') showCurrent();
    else render();
  });
}

// The Interview tab. Keeps the section you were on unless the current candidate changed.
export function showCurrent(wanted?: Section): void {
  visible = true;
  mode = 'current';
  const id = currentId();
  const changed = id !== candidateId;
  candidateId = id;
  render();
  if (candidateId) showSection(wanted || (changed ? 'interview' : section));
  else onChange();
}

// Someone's page from Upcoming or Jobs. Without a section: Notes if they've been interviewed, else Plan.
export function browseCandidate(id: string, wanted: Section | undefined, from: Tab): void {
  visible = true;
  mode = 'browse';
  candidateId = id;
  backTo = from;
  $('personBackLabel').textContent = from === 'jobs' ? 'Jobs' : 'Upcoming';
  render();
  const interviewed = S.interviewsFor(getState(), id).some((iv) => iv.endedAt);
  showSection(wanted || (interviewed ? 'notes' : 'plan'));
}

// Another page is showing: stop redrawing this one on every change.
export function hideCandidatePage(): void {
  visible = false;
}

export function showSection(next: Section): void {
  section = next;
  for (const s of SECTIONS) {
    $(`sec-${s}`).setAttribute('aria-selected', String(s === next));
    $(`section-${s}`).hidden = s !== next;
  }
  onChange();
}

function render() {
  const state = getState();
  const cand = S.getCandidate(state, candidateId);
  const job = cand && S.getJob(state, cand.jobId);

  if (!cand || !job) {
    if (mode === 'browse') return nav.tab(backTo); // deleted while you looked at it
    $('personPage').hidden = true;
    $('nowEmpty').hidden = false;
    $('nowEmpty').replaceChildren(...emptyState(state));
    return;
  }
  $('nowEmpty').hidden = true;
  $('personPage').hidden = false;
  $('personBack').hidden = mode === 'current';

  $('personName').textContent = cand.name;
  $('personMeta').textContent = [S.jobLabel(job), S.STAGE_LABELS[cand.stage], cand.interviewAt ? formatDate(cand.interviewAt) : '']
    .filter(Boolean)
    .join(' · ');
  const profile = $<HTMLAnchorElement>('personProfile');
  profile.hidden = !cand.profileUrl;
  if (cand.profileUrl) profile.href = cand.profileUrl;

  renderPlanSection(cand.id);
  const isCurrent = mode === 'current';
  $('liveArea').hidden = !isCurrent;
  $('liveSwitchBox').hidden = isCurrent;
  if (isCurrent) renderInterviewSection(cand.id);
  else renderSwitchBox(cand);
  renderNotes(cand);
}

// The Interview tab when no one is due.
function emptyState(state: S.State): HTMLElement[] {
  if (!state.jobs.length) {
    return [
      el('h2', {}, 'Who are you interviewing?'),
      el('p', { class: 'muted' }, 'Add the job you’re hiring for and its candidates. Your next interview shows up here.'),
      el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.addJob() }, 'Add a job'),
      el('button', { class: 'link-btn', type: 'button', onclick: () => nav.demo() }, 'Watch a short demo first'),
    ];
  }
  return [
    el('h2', {}, 'No interview right now'),
    el('p', { class: 'muted' }, 'Candidates with an interview today or later show up here. Pick someone in Upcoming, or give a candidate an interview date.'),
    el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.tab('upcoming') }, 'Go to Upcoming'),
  ];
}

// Looking at someone who isn't the current candidate: offer to make them current.
function renderSwitchBox(cand: S.Candidate) {
  const state = getState();
  const busyWith = S.getCandidate(state, currentId());
  const running = busyWith && busyWith.id !== cand.id && S.openInterview(state, busyWith.id);
  $('liveSwitchBox').replaceChildren(
    running
      ? el('p', {}, `You’re in an interview with ${busyWith.name}. End it before you start another.`)
      : el('p', {}, `Ready to talk to ${cand.name}? This opens the interview in the Interview tab.`),
    el(
      'div',
      { class: 'row' },
      running
        ? el('button', { class: 'soft-btn', type: 'button', onclick: () => nav.tab('interview') }, `Back to ${busyWith.name}`)
        : el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.interviewWith(cand.id) }, `Interview ${cand.name} now`),
    ),
  );
}

// Notes: every interview that has ended, newest first, with what you wrote.
function renderNotes(cand: S.Candidate) {
  const state = getState();
  const running = S.openInterview(state, cand.id);
  const past = S.interviewsFor(state, cand.id).filter((iv) => iv.endedAt);
  const parts: HTMLElement[] = [];
  if (running) {
    parts.push(
      el(
        'p',
        { class: 'warn' },
        'An interview is in progress. ',
        el('button', { class: 'link-btn inline', type: 'button', onclick: () => (mode === 'current' ? showSection('interview') : nav.tab('interview')) }, 'Go to Interview'),
      ),
    );
  }
  if (!past.length) {
    parts.push(el('p', { class: 'muted' }, 'No finished interviews yet. When you end an interview, your notes are kept here.'));
  }
  for (const iv of past) {
    const { covered, total } = S.coverage(iv);
    const written = iv.skills.filter((s) => s.notes.trim());
    parts.push(
      el(
        'section',
        { class: 'card' },
        el(
          'div',
          { class: 'section-head' },
          el('h3', {}, formatDate(new Date(iv.startedAt).toISOString())),
          el('span', { class: 'muted' }, `${covered} of ${total} covered`),
        ),
        written.length || iv.generalNotes.trim()
          ? el(
              'ul',
              { class: 'note-list' },
              ...written.map((s) => el('li', {}, el('b', {}, s.name), el('p', { class: 'note-text' }, s.notes))),
              iv.generalNotes.trim() ? el('li', {}, el('b', {}, 'Other notes'), el('p', { class: 'note-text' }, iv.generalNotes)) : null,
            )
          : el('p', { class: 'muted' }, 'No notes were written.'),
        el(
          'div',
          { class: 'row end' },
          el('button', { class: 'soft-btn small', type: 'button', onclick: () => copy(S.interviewMarkdown(getState(), iv.id), 'Notes copied.') }, 'Copy notes'),
        ),
      ),
    );
  }
  $('section-notes').replaceChildren(...parts);
}
