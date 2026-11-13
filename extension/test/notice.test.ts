import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidateNotice } from '../src/notice.ts';

test('the written notice names the company, the services, how long notes are kept and who to ask', () => {
  const { written } = candidateNotice({ company: 'Northwind', contact: 'privacy@northwind.example', retentionDays: 90 });
  assert.match(written, /^How we take notes in your interview\n/);
  assert.match(written, /In your interview with Northwind, /);
  assert.match(written, /Deepgram/);
  assert.match(written, /Anthropic’s Claude\) may read your resume to suggest questions to ask\. Debrief’s server doesn’t store it\./);
  assert.match(written, /doesn’t record or keep the audio/);
  assert.match(written, /transcript is deleted when the interview ends/);
  assert.match(written, /for up to 90 days\./);
  assert.match(written, /People at Northwind make every decision\./);
  assert.match(written, /won’t count against you/);
  assert.match(written, /\n\nQuestions about your data: privacy@northwind\.example$/);
});

test('without a company or contact, the notice still reads well', () => {
  const { written } = candidateNotice({ company: '  ', contact: '', retentionDays: 0 });
  assert.match(written, /In your interview, the interviewer/);
  assert.match(written, /People make every decision\./);
  assert.match(written, /until the interviewer deletes them\./);
  assert.doesNotMatch(written, /Questions about your data|undefined|  /);
});

test('retention wording', () => {
  assert.match(candidateNotice({ company: '', contact: '', retentionDays: 365 }).written, /for up to a year\./);
  assert.match(candidateNotice({ company: '', contact: '', retentionDays: 30 }).written, /for up to 30 days\./);
});

test('the spoken version is one short question that asks for an OK', () => {
  const { spoken } = candidateNotice({ company: 'Northwind', contact: '', retentionDays: 90 });
  assert.ok(spoken.length < 200);
  assert.match(spoken, /transcribes this call/);
  assert.match(spoken, /Is that OK with you\?$/);
});
