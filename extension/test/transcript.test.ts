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

// ---------- Speaker labels (microphone included) ----------
import { speakerFor, recentText, lastQuestion, type LevelSample, type Transcript } from '../src/transcript.ts';

const timed = (transcript: string, start: number, duration: number) => ({ ...result(transcript, true), start, duration });
// 10 samples a second: mic loud from 0 to 2 s (you), call loud from 2 to 5 s (them), both quiet after.
const levels: LevelSample[] = Array.from({ length: 70 }, (_, i) => {
  const t = i / 10;
  return { t, mic: t < 2 ? 0.2 : 0.02, tab: t >= 2 && t < 5 ? 0.15 : 0.005 };
});

test('a line is yours when the microphone was clearly louder than the call', () => {
  assert.equal(speakerFor(levels, 0.2, 1.8), 'you');
  assert.equal(speakerFor(levels, 2.5, 4.5), 'them');
});

test('a quiet microphone is never you, and no samples means no label', () => {
  assert.equal(speakerFor(levels, 5.5, 6.5), 'them'); // mic 0.02 beats the call, but it's room noise, not speech
  assert.equal(speakerFor([{ t: 1, mic: 0.005, tab: 0 }], 0, 2), 'them');
  assert.equal(speakerFor(levels, 20, 30), undefined);
  assert.equal(speakerFor([], 0, 1), undefined);
});

test('final lines get a speaker when whoSpoke is given and Deepgram sent times', () => {
  const who = (start: number, end: number) => speakerFor(levels, start, end);
  let t = applyMessage(emptyTranscript(), timed('How did you find the slow queries?', 0.1, 1.7), who);
  t = applyMessage(t, timed('We logged every query over 200 milliseconds.', 2.2, 2.5), who);
  t = applyMessage(t, result('pending', false), who);
  assert.deepEqual(t.lines.map((l) => l.speaker), ['you', 'them']);
  assert.equal(transcriptText(t), 'You: How did you find the slow queries?\nThem: We logged every query over 200 milliseconds.\npending');
});

test('without whoSpoke or times, lines have no speaker (microphone off)', () => {
  let t = applyMessage(emptyTranscript(), timed('Hello', 0, 1));
  t = applyMessage(t, result('No times', true), () => 'you');
  assert.deepEqual(t.lines, [{ text: 'Hello', final: true }, { text: 'No times', final: true }]);
});

test('with labels, the recent answer is what they said since your last line', () => {
  const t: Transcript = {
    interim: '',
    lines: [
      { text: 'Old answer.', final: true, speaker: 'them' },
      { text: 'Tell me about indexes?', final: true, speaker: 'you' },
      { text: 'We added a composite index.', final: true, speaker: 'them' },
      { text: 'It cut the time by half.', final: true, speaker: 'them' },
    ],
  };
  assert.equal(recentText(t), 'We added a composite index. It cut the time by half.');
  assert.equal(lastQuestion(t), 'Tell me about indexes?');
  // Right after your question: their previous lines, never yours.
  const asked: Transcript = { interim: '', lines: [...t.lines, { text: 'And then?', final: true, speaker: 'you' }] };
  assert.equal(recentText(asked), 'Old answer. We added a composite index. It cut the time by half.');
  assert.equal(lastQuestion(asked), 'And then?');
  assert.equal(lastQuestion(emptyTranscript()), '');
});
