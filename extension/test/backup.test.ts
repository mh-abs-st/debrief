import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../src/store.ts';

const NOW = Date.parse('2026-11-13T12:00:00Z');

function sample() {
  let { state, job } = S.addJob(S.emptyState(), { title: 'Backend', company: 'Acme', skills: [{ name: 'SQL', why: 'reports' }] }, NOW);
  const a = S.addCandidate(state, job.id, { name: 'Ana', profileUrl: 'linkedin.com/in/ana', resumeText: 'SQL 5 years', interviewAt: '2026-11-20T10:00' }, NOW);
  state = S.updateCandidate(a.state, a.candidate.id, {
    plan: S.planForJob({ opening: 'Hi', skills: [{ name: 'SQL', resumeShows: '5 years', askAbout: 'scale', questions: ['Biggest table?'] }], verify: [{ claim: '60% faster', question: 'How measured?' }] }, job),
  }, NOW);
  const iv = S.startInterview(state, a.candidate.id, NOW);
  state = S.setSkillNotes(iv.state, iv.interview.id, 0, 'Partitioned tables');
  return S.endInterview(state, iv.interview.id, NOW + 1000);
}

const roundTrip = (state: S.State) => S.readBackup(JSON.stringify(S.makeBackup(state, NOW)), NOW);

test('a backup restores to exactly the same data', () => {
  const state = sample();
  const back = roundTrip(state);
  assert.ok('state' in back);
  assert.deepEqual(back.state, state);
  assert.equal(back.skipped, 0);
});

test('the backup says what it is and has no settings or token in it', () => {
  const backup = S.makeBackup(sample(), NOW);
  assert.equal(backup.app, 'debrief');
  assert.equal(backup.version, 1);
  assert.equal(backup.exportedAt, '2026-11-13T12:00:00.000Z');
  assert.match(backup.note, /candidate data/);
  assert.deepEqual(Object.keys(backup.data).sort(), ['candidates', 'interviews', 'jobs']);
  assert.doesNotMatch(JSON.stringify(backup), /appToken|serverUrl/);
  assert.equal(S.backupFileName(NOW), 'debrief-backup-2026-11-13.json');
});

test('files that aren’t a Debrief backup are refused with a plain message', () => {
  for (const text of ['not json', '[]', '{"jobs":[]}', JSON.stringify({ app: 'other', version: 1, data: {} })]) {
    const r = S.readBackup(text, NOW);
    assert.ok('error' in r && /isn’t a Debrief backup/.test(r.error), text);
  }
  const newer = S.readBackup(JSON.stringify({ app: 'debrief', version: 99, data: {} }), NOW);
  assert.ok('error' in newer && /newer version/.test(newer.error));
});

test('damaged entries are cleaned or left out, never trusted', () => {
  const state = sample();
  const backup = S.makeBackup(state, NOW) as unknown as { data: Record<string, unknown[]> };
  const [cand] = backup.data.candidates as Array<Record<string, unknown>>;
  cand.profileUrl = 'javascript:alert(1)';
  cand.stage = 'hired';
  cand.plan = { opening: 5, skills: 'not a list', verify: [null, { claim: 'x' }] };
  backup.data.jobs.push(null as unknown as Record<string, unknown>, { title: 'No id' }, { ...(backup.data.jobs[0] as object) }); // duplicate id
  backup.data.candidates.push({ id: 'orphan', jobId: 'gone', name: 'Nobody' });
  backup.data.interviews.push({ id: 'iv_orphan', candidateId: 'orphan' }, 'junk' as unknown as Record<string, unknown>);
  const r = S.readBackup(JSON.stringify(backup), NOW);
  assert.ok('state' in r);
  assert.equal(r.skipped, 6);
  assert.equal(r.state.jobs.length, 1);
  assert.equal(r.state.candidates.length, 1);
  assert.equal(r.state.interviews.length, 1);
  const c = r.state.candidates[0];
  assert.equal(c.profileUrl, ''); // the javascript: link is dropped
  assert.equal(c.stage, 'new');
  assert.deepEqual(c.plan, { opening: '5', skills: [], verify: [{ claim: 'x', question: '' }] });
});

test('missing dates become the restore time, so retention doesn’t delete them at once', () => {
  const text = JSON.stringify({
    app: 'debrief',
    version: 1,
    data: { jobs: [{ id: 'j1', title: 'Ops' }], candidates: [{ id: 'c1', jobId: 'j1', name: 'Bo' }], interviews: [] },
  });
  const r = S.readBackup(text, NOW);
  assert.ok('state' in r);
  assert.equal(r.state.candidates[0].updatedAt, NOW);
  assert.equal(S.purgeExpired(r.state, 30, NOW).removed, 0);
});
