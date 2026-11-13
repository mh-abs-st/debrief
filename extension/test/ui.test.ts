import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toastDuration } from '../src/ui.ts';

test('other messages fade after 3.5 seconds', () => {
  assert.equal(toastDuration('Saved.', false), 3500);
  assert.equal(toastDuration('x'.repeat(500), false), 3500);
});

test('errors stay at least 10 seconds, longer for long messages, at most 20', () => {
  assert.equal(toastDuration('Nothing in the transcript yet.', true), 10_000);
  const chromeOk = 'Chrome needs your OK for this tab. Click the Debrief icon in the toolbar while you’re on the call tab, then press Start listening again. The panel stays open.';
  assert.equal(toastDuration(chromeOk, true), chromeOk.length * 70);
  assert.ok(toastDuration(chromeOk, true) > 10_000);
  assert.equal(toastDuration('x'.repeat(200), true), 14_000);
  assert.equal(toastDuration('x'.repeat(1000), true), 20_000);
});
