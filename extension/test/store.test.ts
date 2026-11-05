import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/store.ts';

const DAY = 24 * 60 * 60 * 1000;

function seed(now = 1_000_000) {
  let { state, job } = S.addJob(S.emptyState(), { title: ' Backend Engineer ', company: 'Northwind', skills: [{ name: 'Node.js', why: 'API' }, { name: 'SQL' }, { name: '' }] }, now);
  const a = S.addCandidate(state, job.id, { name: 'Ana', profileUrl: 'linkedin.com/in/ana', resumeText: 'Node 5 years' }, now);
  const b = S.addCandidate(a.state, job.id, { name: 'Ben' }, now + 1);
  return { state: b.state, job, ana: a.candidate, ben: b.candidate };
}

test('jobs are cleaned: trimmed title, empty skills dropped, open by default', () => {
  const { job } = seed();
  assert.equal(job.title, 'Backend Engineer');
  assert.deepEqual(job.skills, [{ name: 'Node.js', why: 'API' }, { name: 'SQL', why: '' }]);
  assert.equal(job.status, 'open');
});

test('a job holds several candidates', () => {
  const { state, job } = seed();
  assert.deepEqual(S.candidatesFor(state, job.id).map((c) => c.name), ['Ana', 'Ben']);
});

test('candidates for a missing job are refused', () => {
  assert.throws(() => S.addCandidate(S.emptyState(), 'nope', { name: 'X' }), /no longer exists/);
});

test('profile links: bare domains get https, unsafe schemes are dropped', () => {
  assert.equal(S.cleanUrl('linkedin.com/in/ana'), 'https://linkedin.com/in/ana');
  assert.equal(S.cleanUrl('javascript:alert(1)'), '');
  assert.equal(S.cleanUrl('ftp://x.org/cv'), '');
  assert.equal(S.cleanUrl(''), '');
});

test('a new resume clears the old interview plan', () => {
  let { state, ana } = seed();
  state = S.updateCandidate(state, ana.id, { plan: { opening: '', skills: [], verify: [] } });
  assert.ok(S.getCandidate(state, ana.id)?.plan);
  state = S.updateCandidate(state, ana.id, { resumeText: 'Node 5 years' }); // same text: plan kept
  assert.ok(S.getCandidate(state, ana.id)?.plan);
  state = S.updateCandidate(state, ana.id, { resumeText: 'Go 3 years' });
  assert.equal(S.getCandidate(state, ana.id)?.plan, null);
});

test('interviews copy the job skills and track coverage and notes', () => {
  let { state, ana } = seed();
  const started = S.startInterview(state, ana.id, 2000);
  state = S.setSkillCovered(started.state, started.interview.id, 0, true);
  state = S.setSkillNotes(state, started.interview.id, 0, 'Built a queue service');
  const iv = S.openInterview(state, ana.id);
  assert.deepEqual(S.coverage(iv), { covered: 1, total: 2 });
  assert.equal(iv?.skills[0].notes, 'Built a queue service');
});

test('ending an interview marks the candidate interviewed, but not if already decided', () => {
  let { state, ana, ben } = seed();
  let r = S.startInterview(state, ana.id, 2000);
  state = S.endInterview(r.state, r.interview.id, 3000);
  assert.equal(S.getCandidate(state, ana.id)?.stage, 'interviewed');
  assert.equal(S.openInterview(state, ana.id), null);

  state = S.updateCandidate(state, ben.id, { stage: 'decided' });
  r = S.startInterview(state, ben.id, 4000);
  state = S.endInterview(r.state, r.interview.id, 5000);
  assert.equal(S.getCandidate(state, ben.id)?.stage, 'decided');
});

test('deleting a candidate deletes their interviews; deleting a job deletes everything under it', () => {
  let { state, job, ana, ben } = seed();
  state = S.startInterview(state, ana.id).state;
  state = S.startInterview(state, ben.id).state;
  const afterCand = S.removeCandidate(state, ana.id);
  assert.equal(afterCand.candidates.length, 1);
  assert.equal(afterCand.interviews.every((i) => i.candidateId !== ana.id), true);
  const afterJob = S.removeJob(state, job.id);
  assert.deepEqual(afterJob, S.emptyState());
});

test('retention removes candidates untouched for longer than the setting', () => {
  const now = 100 * DAY;
  let { state, ana } = seed(now - 40 * DAY); // both created 40 days ago
  state = S.updateCandidate(state, ana.id, { stage: 'scheduled' }, now - 5 * DAY); // Ana touched recently
  const { state: kept, removed } = S.purgeExpired(state, 30, now);
  assert.equal(removed, 1);
  assert.deepEqual(kept.candidates.map((c) => c.name), ['Ana']);
  assert.equal(S.purgeExpired(state, 0, now).removed, 0); // 0 = keep until deleted
});

test('notes export: only what was written, no assessment', () => {
  let { state, ana } = seed();
  const r = S.startInterview(state, ana.id, Date.UTC(2026, 10, 4));
  state = S.setSkillNotes(r.state, r.interview.id, 1, 'Explained indexes clearly');
  state = S.setGeneralNotes(state, r.interview.id, 'Asked about team size');
  const md = S.interviewMarkdown(state, r.interview.id);
  assert.match(md, /^# Interview notes: Ana/);
  assert.match(md, /Job: Backend Engineer · Northwind/);
  assert.match(md, /Date: 2026-11-04/);
  assert.match(md, /## SQL[\s\S]*Explained indexes clearly/);
  assert.match(md, /## Other notes[\s\S]*team size/);
  assert.doesNotMatch(md, /score|rating|fit/i);
});

test('upcoming groups candidates by interview day, running interviews first', () => {
  let { state, job } = seed();
  const add = (name: string, interviewAt: string, stage?: string) => {
    const r = S.addCandidate(state, job.id, { name, interviewAt, stage });
    state = r.state;
    return r.candidate;
  };
  add('Today late', '2026-11-05T15:00', 'scheduled');
  add('Today early', '2026-11-05T09:00', 'scheduled');
  add('Tomorrow', '2026-11-06T10:00', 'scheduled');
  add('Last week', '2026-10-29T10:00', 'scheduled');
  add('Done', '2026-11-05T11:00', 'interviewed');
  const running = add('Running', '2026-11-04T10:00', 'interviewed');
  state = S.startInterview(state, running.id).state;

  const g = S.upcoming(state, '2026-11-05');
  const names = (list: S.Candidate[]) => list.map((c) => c.name);
  assert.deepEqual(names(g.inProgress), ['Running']);
  assert.deepEqual(names(g.today), ['Today early', 'Today late']);
  assert.deepEqual(names(g.later), ['Tomorrow']);
  assert.deepEqual(names(g.earlier), ['Last week']);
  assert.deepEqual(names(g.unscheduled), ['Ana', 'Ben']); // seeded without a date
});

test('upcoming leaves out candidates of closed jobs', () => {
  let { state, job } = seed();
  state = S.updateJob(state, job.id, { status: 'closed' });
  const g = S.upcoming(state, '2026-11-05');
  assert.equal(Object.values(g).flat().length, 0);
});

test('current candidate: a running interview first, then your choice, then the next one due', () => {
  let { state, job, ana, ben } = seed();
  assert.equal(S.currentCandidateId(state, '2026-11-05'), ''); // nobody has a date yet

  const later = S.addCandidate(state, job.id, { name: 'Later', interviewAt: '2026-11-07T09:00' });
  const today = S.addCandidate(later.state, job.id, { name: 'Today', interviewAt: '2026-11-05T14:00' });
  state = today.state;
  assert.equal(S.currentCandidateId(state, '2026-11-05'), today.candidate.id); // today beats later
  assert.equal(S.currentCandidateId(state, '2026-11-08'), ''); // both dates passed
  assert.equal(S.currentCandidateId(state, '2026-11-06'), later.candidate.id);

  assert.equal(S.currentCandidateId(state, '2026-11-05', ben.id), ben.id); // your choice beats the schedule
  assert.equal(S.currentCandidateId(state, '2026-11-05', 'deleted'), today.candidate.id);

  state = S.startInterview(state, ana.id, 1000).state;
  assert.equal(S.currentCandidateId(state, '2026-11-05', ben.id), ana.id); // a running interview beats everything
});

test('localDateKey uses the local calendar day', () => {
  assert.equal(S.localDateKey(new Date(2026, 0, 5, 23, 30)), '2026-01-05');
});

test('normalize repairs missing or damaged stored data', () => {
  assert.deepEqual(S.normalize(null), S.emptyState());
  assert.deepEqual(S.normalize({ jobs: 'x' }), S.emptyState());
});
