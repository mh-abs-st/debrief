import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoAt, DEMO_STEPS, DEMO_JOB, DEMO_PLAN, DEMO_LENGTH_MS } from '../demo-script.js';

test('nothing is covered before the candidate talks', () => {
  const s = demoAt(0);
  assert.equal(s.lines.length, 1);
  assert.equal(s.covered.size, 0);
  assert.deepEqual(s.suggestions, []);
});

test('skills tick and suggestions appear as the script plays', () => {
  const mid = demoAt(12_000);
  assert.ok(mid.covered.has(0));
  assert.equal(mid.suggestions.length, 2);
  const end = demoAt(DEMO_LENGTH_MS);
  assert.deepEqual([...end.covered].sort(), [0, 1, 2]);
  assert.equal(end.suggestions[0], 'What broke anyway, and how did you find out?');
  assert.equal(end.done, true);
});

test('the script is in time order and only covers real skills', () => {
  for (let i = 1; i < DEMO_STEPS.length; i++) assert.ok(DEMO_STEPS[i].at >= DEMO_STEPS[i - 1].at);
  for (const s of DEMO_STEPS) if (s.cover !== undefined) assert.ok(s.cover < DEMO_JOB.skills.length);
});

test('demo plan matches the job and has no score', () => {
  assert.deepEqual(DEMO_PLAN.skills.map((s) => s.name), DEMO_JOB.skills.map((s) => s.name));
  assert.doesNotMatch(JSON.stringify(DEMO_PLAN), /score|fit|rating/i);
});

test('demo people and company are marked as examples', () => {
  assert.match(DEMO_JOB.company, /example/);
});
