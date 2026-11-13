// A candidate's page: their header, then Plan, Interview and Notes. It has two modes:
// - 'current': the Interview tab. Shows the current candidate (running interview, your choice, or next due).
// - 'browse': opened from Upcoming or Jobs to look at someone else, with Back. Their Interview part offers
//   "Interview … now" instead of the interview itself, so looking around never stops a running transcription.
import { $, el, formatDate, closestTarget, toast, confirmSheet, type Nav, type Section, type Tab } from './ui.ts';
import { getState, subscribe, commit } from './data.ts';
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
// The finished interview whose notes are being edited, with what's typed so far (kept across re-renders).
let editing: { id: string; draft: S.NotesEdit } | null = null;

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
      el('img', { class: 'brand-logo', src: 'icons/logo.svg', alt: '', width: 64, height: 64 }),
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
  if (editing && !past.some((iv) => iv.id === editing?.id)) editing = null; // deleted meanwhile
  for (const iv of past) {
    if (editing?.id === iv.id) {
      parts.push(notesEditor(iv, editing.draft));
      continue;
    }
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
          el('button', { class: 'link-btn danger small', type: 'button', onclick: () => removeInterview(iv) }, 'Delete'),
          el('span', { class: 'spacer' }),
          el('button', { class: 'soft-btn small', type: 'button', onclick: () => startEditing(iv) }, 'Edit'),
          el('button', { class: 'soft-btn small', type: 'button', onclick: () => copy(S.interviewMarkdown(getState(), iv.id), 'Notes copied.') }, 'Copy notes'),
        ),
      ),
    );
  }
  $('section-notes').replaceChildren(...parts);
}

// ---------- Editing and deleting a finished interview ----------

function startEditing(iv: S.Interview) {
  editing = { id: iv.id, draft: { skills: iv.skills.map((sk) => ({ covered: sk.covered, notes: sk.notes })), generalNotes: iv.generalNotes } };
  const cand = S.getCandidate(getState(), iv.candidateId);
  if (cand) renderNotes(cand);
  $('section-notes').querySelector<HTMLTextAreaElement>('textarea')?.focus();
}

// The same fields as during the interview: a tick and notes per skill, then Other notes.
function notesEditor(iv: S.Interview, draft: S.NotesEdit): HTMLElement {
  const date = formatDate(new Date(iv.startedAt).toISOString());
  const area = (label: string, value: string, oninput: (v: string) => void) =>
    el('textarea', { rows: '3', 'aria-label': label, oninput: (e: Event) => oninput((e.target as HTMLTextAreaElement).value) }, value);
  return el(
    'section',
    { class: 'card editing' },
    el('div', { class: 'section-head' }, el('h3', {}, `Edit notes: ${date}`)),
    el(
      'ul',
      { class: 'checklist' },
      ...iv.skills.map((sk, i) =>
        el(
          'li',
          {},
          el(
            'label',
            { class: 'check' },
            el('input', { type: 'checkbox', checked: draft.skills[i]?.covered || false, onchange: (e: Event) => (draft.skills[i].covered = (e.target as HTMLInputElement).checked) }),
            el('span', {}, sk.name),
          ),
          area(`Notes for ${sk.name}`, draft.skills[i]?.notes || '', (v) => (draft.skills[i].notes = v)),
        ),
      ),
      el('li', {}, el('b', {}, 'Other notes'), area('Other notes', draft.generalNotes, (v) => (draft.generalNotes = v))),
    ),
    el(
      'div',
      { class: 'row end' },
      el('button', { class: 'soft-btn small', type: 'button', onclick: () => stopEditing() }, 'Cancel'),
      el('button', { class: 'primary-btn small', type: 'button', onclick: () => saveEdit(iv.id, draft) }, 'Save notes'),
    ),
  );
}

function stopEditing() {
  editing = null;
  const cand = S.getCandidate(getState(), candidateId);
  if (cand) renderNotes(cand);
}

async function saveEdit(interviewId: string, draft: S.NotesEdit) {
  if (!(await commit(S.editInterviewNotes(getState(), interviewId, draft)))) return; // error shown; keep editing
  editing = null;
  stopEditing();
  toast('Notes saved.');
}

async function removeInterview(iv: S.Interview) {
  const name = S.getCandidate(getState(), iv.candidateId)?.name || 'this candidate';
  const ok = await confirmSheet({
    title: 'Delete this interview?',
    body: `This deletes the interview with ${name} on ${formatDate(new Date(iv.startedAt).toISOString())} and all its notes. This can’t be undone.`,
    yes: 'Delete interview',
  });
  if (!ok) return;
  if (await commit(S.deleteInterview(getState(), iv.id))) toast('Interview deleted.');
}
