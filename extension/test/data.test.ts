import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// A chrome.storage.local stand-in whose writes can be made to fail.
const stored: Record<string, unknown> = {};
let failWith: Error | null = null;
(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (defaults: Record<string, unknown>) => ({ ...defaults, ...stored }),
      set: async (items: Record<string, unknown>) => {
        if (failWith) throw failWith;
        Object.assign(stored, structuredClone(items));
      },
      remove: async (key: string) => {
        if (failWith) throw failWith;
        delete stored[key];
      },
    },
  },
};

const D = await import('../src/data.ts');
const S = await import('../src/store.ts');

let reported: unknown[] = [];
D.onSaveError((err) => reported.push(err));

beforeEach(async () => {
  failWith = null;
  reported = [];
  for (const k of Object.keys(stored)) delete stored[k];
  await D.commit(S.emptyState(), { quiet: true });
});

const withJob = () => S.addJob(D.getState(), { title: 'Backend' }).state;

test('a save that works returns true and is stored', async () => {
  assert.equal(await D.commit(withJob()), true);
  assert.equal((stored.debriefData as { jobs: unknown[] }).jobs.length, 1);
  assert.deepEqual(reported, []);
});

test('a failed save returns false, is reported, and never throws', async () => {
  failWith = new Error('IO error: disk full');
  let redrawn = 0;
  const off = D.subscribe(() => redrawn++);
  assert.equal(await D.commit(withJob()), false);
  off();
  assert.equal(reported.length, 1);
  assert.equal((stored.debriefData as { jobs: unknown[] }).jobs.length, 0); // not stored
  // The change stays in memory and on screen, and the next save that works stores it.
  assert.equal(D.getState().jobs.length, 1);
  assert.equal(redrawn, 1);
  failWith = null;
  assert.equal(await D.commit(D.getState()), true);
  assert.equal((stored.debriefData as { jobs: unknown[] }).jobs.length, 1);
});

test('notes typed (commitSoon) that fail to save are reported too', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    failWith = new Error('IO error');
    D.commitSoon(withJob());
    mock.timers.tick(400);
    await new Promise((r) => setImmediate(r));
    assert.equal(reported.length, 1);
  } finally {
    mock.timers.reset();
  }
});

test('the error message says what to do, and tells a full store apart', () => {
  assert.match(D.saveErrorMessage(new Error('IO error')), /couldn’t save.*lost when you close the panel/);
  assert.match(D.saveErrorMessage(new Error('QUOTA_BYTES quota exceeded')), /storage for Debrief is full/);
});

test('settings that fail to save return false and are reported', async () => {
  failWith = new Error('IO error');
  assert.equal(await D.saveSettings({ language: 'de' }), false);
  assert.equal(reported.length, 1);
});

test('delete all: if storage can’t be cleared, the data is kept and it says so', async () => {
  await D.commit(withJob());
  failWith = new Error('IO error');
  assert.equal(await D.deleteAll(), false);
  assert.equal(D.getState().jobs.length, 1);
  failWith = null;
  assert.equal(await D.deleteAll(), true);
  assert.equal(D.getState().jobs.length, 0);
  assert.equal(stored.debriefData, undefined);
});
