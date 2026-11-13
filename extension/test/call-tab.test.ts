import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leftCallSite } from '../src/call-tab.ts';

test('moving inside the call’s own site keeps listening', () => {
  assert.equal(leftCallSite('https://meet.google.com/abc-defg-hij', 'https://meet.google.com/abc-defg-hij?authuser=1'), false);
  assert.equal(leftCallSite('https://app.zoom.us/wc/123/join', 'https://app.zoom.us/wc/123/start'), false);
  assert.equal(leftCallSite('https://teams.microsoft.com/v2/', 'https://teams.microsoft.com/v2/#/meeting'), false);
});

test('going to another site stops listening', () => {
  assert.equal(leftCallSite('https://meet.google.com/abc-defg-hij', 'https://www.google.com/'), true);
  assert.equal(leftCallSite('https://meet.google.com/abc-defg-hij', 'https://mail.google.com/mail/u/0/'), true);
  assert.equal(leftCallSite('https://app.zoom.us/wc/123/join', 'http://app.zoom.us/wc/123/join'), true);
});

test('an address we can’t read keeps listening', () => {
  assert.equal(leftCallSite('https://meet.google.com/abc', ''), false);
  assert.equal(leftCallSite('', 'https://meet.google.com/abc'), false);
});
