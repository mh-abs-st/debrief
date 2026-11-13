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

import { howToInvoke, needsOkMessage } from '../src/call-tab.ts';

test('the Chrome-needs-your-OK message names the keyboard shortcut when there is one', () => {
  assert.equal(
    needsOkMessage('Alt+Shift+D'),
    'Chrome needs your OK for this tab. Click the Debrief icon in the toolbar, or press Alt+Shift+D, while you’re on the call tab, then press Start listening again. The panel stays open.',
  );
  assert.match(needsOkMessage('⌥⇧D'), /or press ⌥⇧D,/);
});

test('without a shortcut, it says where to set one', () => {
  assert.equal(howToInvoke(''), 'click the Debrief icon in the toolbar while you’re on the call tab (you can set a keyboard shortcut at chrome://extensions/shortcuts)');
  assert.doesNotMatch(needsOkMessage(''), /press  |undefined/);
});
