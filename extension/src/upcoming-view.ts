// Upcoming tab: who you're interviewing next, across all open jobs. Tap a candidate to open their page.
import { $, el, type Nav } from './ui.ts';
import { getState, subscribe } from './data.ts';
import { listeningCandidate } from './interview-view.ts';
import * as S from './store.ts';

let nav: Nav;

export function initUpcoming(navigation: Nav): void {
  nav = navigation;
  subscribe(renderUpcoming);
  renderUpcoming();
}

const GROUPS: Array<{ key: keyof S.UpcomingGroups; title: string }> = [
  { key: 'inProgress', title: 'In progress' },
  { key: 'today', title: 'Today' },
  { key: 'later', title: 'Coming up' },
  { key: 'earlier', title: 'Date passed' },
  { key: 'unscheduled', title: 'No date yet' },
];

// Redrawn on every change and whenever the tab is shown (so "Today" follows the clock).
export function renderUpcoming(): void {
  const state = getState();
  const groups = S.upcoming(state, S.localDateKey(new Date()));
  const empty = $('upEmpty');
  const list = $('upGroups');
  const total = Object.values(groups).reduce((n, g) => n + g.length, 0);

  if (!total) {
    list.replaceChildren();
    empty.hidden = false;
    empty.replaceChildren(...emptyState(state));
    return;
  }
  empty.hidden = true;
  list.replaceChildren(
    ...GROUPS.filter((g) => groups[g.key].length).map((g) =>
      el('section', { class: 'group' }, el('h3', { class: 'group-title' }, g.title), el('ul', { class: 'cards' }, ...groups[g.key].map((c) => card(state, c, g.key)))),
    ),
  );
}

function emptyState(state: S.State): HTMLElement[] {
  if (!state.jobs.length) {
    return [
      el('h2', {}, 'Who are you interviewing?'),
      el('p', { class: 'muted' }, 'Add the job you’re hiring for, then its candidates. They’ll show up here, soonest first.'),
      el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.addJob() }, 'Add a job'),
      el('button', { class: 'link-btn', type: 'button', onclick: () => nav.demo() }, 'Watch a short demo first'),
    ];
  }
  const openJobs = state.jobs.filter((j) => j.status === 'open');
  return [
    el('p', { class: 'muted' }, 'No one to interview right now. Candidates you’ve interviewed are in Jobs.'),
    openJobs.length === 1
      ? el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.addCandidate(openJobs[0].id) }, 'Add a candidate')
      : el('button', { class: 'primary-btn', type: 'button', onclick: () => nav.tab('jobs') }, 'Go to Jobs'),
  ];
}

function card(state: S.State, c: S.Candidate, group: keyof S.UpcomingGroups) {
  const job = S.getJob(state, c.jobId);
  const when = group === 'inProgress' ? (listeningCandidate() === c.id ? 'Listening' : 'In progress') : whenLabel(c.interviewAt, group === 'today');
  const facts = [c.plan ? 'Plan ready' : 'No plan yet', c.resumeText ? '' : 'No resume yet'].filter(Boolean);
  return el(
    'li',
    {},
    el(
      'button',
      { class: 'person-card', type: 'button', onclick: () => nav.candidate(c.id) },
      el('span', { class: 'card-top' }, el('span', { class: 'card-title' }, c.name), when ? el('span', { class: 'when' }, when) : null),
      el('span', { class: 'card-sub' }, S.jobLabel(job)),
      el('span', { class: 'card-meta' }, facts.join(' · ')),
    ),
  );
}

// "10:00" today; "Fri, Nov 6, 10:00" on other days. interviewAt is local 'YYYY-MM-DDTHH:mm' (or just a date).
function whenLabel(interviewAt: string, today: boolean): string {
  if (!interviewAt) return '';
  const hasTime = interviewAt.length > 10;
  const d = new Date(hasTime ? interviewAt : `${interviewAt}T00:00`); // a bare date would be read as UTC
  if (Number.isNaN(d.getTime())) return '';
  if (today) return hasTime ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Today';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
}
