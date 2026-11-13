import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWindow, makeLimits, makeUsage, limitsFromEnv, untilMidnight, DEFAULT_LIMITS, type LimitConfig } from '../lib/limits.ts';

const clock = (start = Date.parse('2026-11-13T10:00:00Z')) => {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
};

test('a window allows `limit` hits in any 60 seconds, then says how long to wait', () => {
  const c = clock();
  const w = makeWindow(3, c.now);
  for (let i = 0; i < 3; i++) {
    assert.equal(w.wait('a'), 0);
    w.hit('a');
    c.tick(10_000);
  }
  assert.equal(w.wait('a'), 30); // first hit was 30 s ago
  assert.equal(w.wait('b'), 0); // other clients aren't affected
  c.tick(30_000);
  assert.equal(w.wait('a'), 0);
});

test('a window with limit 0 never refuses; sweep forgets idle clients', () => {
  const c = clock();
  const none = makeWindow(0, c.now);
  for (let i = 0; i < 100; i++) none.hit('a');
  assert.equal(none.wait('a'), 0);
  const w = makeWindow(5, c.now);
  w.hit('a');
  w.hit('b');
  c.tick(61_000);
  w.hit('b');
  w.sweep();
  assert.equal(w.size(), 1);
});

test('per-minute limits are per client and per kind; refusals aren’t counted as usage', () => {
  const c = clock();
  const config: LimitConfig = { ...DEFAULT_LIMITS, aiPerMinute: 2, keysPerMinute: 1 };
  const limits = makeLimits(config, c.now);
  assert.deepEqual(limits.check('ip1', 'skills'), { ok: true });
  assert.deepEqual(limits.check('ip1', 'plan'), { ok: true });
  const third = limits.check('ip1', 'followups');
  assert.equal(third.ok, false);
  assert.ok(!third.ok && third.reason === 'perMinute' && third.retryAfter === 60);
  assert.deepEqual(limits.check('ip2', 'skills'), { ok: true }); // another client
  assert.deepEqual(limits.check('ip1', 'transcribe-token'), { ok: true }); // another kind
  assert.equal(limits.check('ip1', 'transcribe-token').ok, false);
  const [today] = limits.usage.report();
  assert.deepEqual(today.counts, { skills: 2, aiCalls: 3, plan: 1, 'refused.perMinute': 2, 'transcribe-token': 1, transcribeKeys: 1 });
});

test('the daily cap is for everyone together, and resets at midnight UTC', () => {
  const c = clock(Date.parse('2026-11-13T23:59:00Z'));
  const limits = makeLimits({ ...DEFAULT_LIMITS, aiPerDay: 3 }, c.now);
  ['a', 'b', 'c'].forEach((ip) => assert.equal(limits.check(ip, 'skills').ok, true));
  const refused = limits.check('d', 'skills');
  assert.ok(!refused.ok && refused.reason === 'daily' && refused.retryAfter === 60);
  assert.equal(limits.check('d', 'transcribe-token').ok, true); // keys have their own cap
  c.tick(60_000); // midnight
  assert.equal(limits.check('d', 'skills').ok, true);
});

test('wrong tokens: after too many, the client waits even with the right one', () => {
  const c = clock();
  const limits = makeLimits({ ...DEFAULT_LIMITS, badTokenPerMinute: 2 }, c.now);
  assert.equal(limits.guessing('ip').ok, true);
  limits.wrongToken('ip');
  limits.wrongToken('ip');
  const blocked = limits.guessing('ip');
  assert.ok(!blocked.ok && blocked.reason === 'badToken');
  assert.equal(limits.guessing('other').ok, true);
  c.tick(60_001);
  assert.equal(limits.guessing('ip').ok, true);
});

test('usage keeps the last 7 days, newest first', () => {
  const c = clock();
  const usage = makeUsage(c.now);
  for (let d = 0; d < 9; d++) {
    usage.count('skills');
    c.tick(24 * 3600_000);
  }
  const days = usage.report();
  assert.equal(days.length, 7);
  assert.equal(days[0].day, '2026-11-21');
  assert.deepEqual(days[0].counts, { skills: 1, aiCalls: 1 });
});

test('limits from the environment, with defaults for missing or bad values', () => {
  assert.deepEqual(limitsFromEnv({}), DEFAULT_LIMITS);
  const l = limitsFromEnv({ DAILY_AI_CALLS: '0', AI_CALLS_PER_MINUTE: '12', TRANSCRIBE_KEYS_PER_MINUTE: 'lots', DAILY_TRANSCRIBE_KEYS: '-5' });
  assert.equal(l.aiPerDay, 0);
  assert.equal(l.aiPerMinute, 12);
  assert.equal(l.keysPerMinute, DEFAULT_LIMITS.keysPerMinute);
  assert.equal(l.keysPerDay, DEFAULT_LIMITS.keysPerDay);
});

test('seconds until midnight UTC', () => {
  assert.equal(untilMidnight(Date.parse('2026-11-13T23:00:00Z')), 3600);
  assert.equal(untilMidnight(Date.parse('2026-11-13T00:00:00Z')), 86400);
});
