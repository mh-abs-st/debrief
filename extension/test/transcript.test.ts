import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listenUrl, emptyTranscript, applyMessage, transcriptText } from '../src/transcript.ts';

const result = (transcript: string, isFinal: boolean) => ({ type: 'Results', is_final: isFinal, channel: { alternatives: [{ transcript }] } });

test('listen URL uses nova-3 and keeps call audio out of training', () => {
  const url = new URL(listenUrl({ language: 'en' }));
  assert.equal(url.host, 'api.deepgram.com');
  assert.equal(url.searchParams.get('model'), 'nova-3');
  assert.equal(url.searchParams.get('interim_results'), 'true');
  assert.equal(url.searchParams.get('mip_opt_out'), 'true');
});

test('interim text is shown, then replaced by the final line', () => {
  let t = emptyTranscript();
  t = applyMessage(t, result('tell me about', false));
  assert.deepEqual(t, { lines: [], interim: 'tell me about' });
  t = applyMessage(t, result('tell me about a project', true));
  assert.deepEqual(t, { lines: [{ text: 'tell me about a project', final: true }], interim: '' });
});

test('empty results and other message types change nothing', () => {
  const t = applyMessage(emptyTranscript(), result('   ', true));
  assert.deepEqual(t, emptyTranscript());
  assert.deepEqual(applyMessage(emptyTranscript(), { type: 'Metadata' }), emptyTranscript());
});

test('the input transcript is not modified', () => {
  const before = emptyTranscript();
  applyMessage(before, result('hello', true));
  assert.deepEqual(before, emptyTranscript());
});

test('copied text includes finals and any pending interim line', () => {
  let t = applyMessage(emptyTranscript(), result('First line.', true));
  t = applyMessage(t, result('Second', false));
  assert.equal(transcriptText(t), 'First line.\nSecond');
});

test('recent text joins only the last few final lines', async () => {
  const { recentText } = await import('../src/transcript.ts');
  let t = emptyTranscript();
  for (const s of ['one', 'two', 'three']) t = applyMessage(t, result(s, true));
  t = applyMessage(t, result('pending', false));
  assert.equal(recentText(t, 2), 'two three');
});
