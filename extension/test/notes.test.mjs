import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startInterview, setCovered, setNotes, coverage, toMarkdown } from '../notes.js';

const skills = [
  { name: 'Node.js', why: 'Build the API' },
  { name: 'SQL' },
];

test('starts every skill uncovered with empty notes', () => {
  const state = startInterview(skills);
  assert.deepEqual(state.skills[1], { name: 'SQL', why: '', covered: false, notes: '' });
  assert.deepEqual(coverage(state), { covered: 0, total: 2 });
});

test('covering and noting a skill leaves the others alone', () => {
  let state = startInterview(skills);
  state = setCovered(state, 0, true);
  state = setNotes(state, 0, 'Shipped a queue service');
  assert.equal(state.skills[0].covered, true);
  assert.equal(state.skills[1].covered, false);
  assert.deepEqual(coverage(state), { covered: 1, total: 2 });
});

test('markdown lists coverage and only what the interviewer typed', () => {
  let state = startInterview(skills);
  state = setCovered(state, 0, true);
  state = setNotes(state, 0, 'Shipped a queue service');
  const md = toMarkdown(state, { date: '2026-11-04' });
  assert.match(md, /^# Interview notes/);
  assert.match(md, /Date: 2026-11-04/);
  assert.match(md, /Skills covered: 1 of 2/);
  assert.match(md, /## Node\.js[\s\S]*Shipped a queue service/);
  assert.match(md, /## SQL[\s\S]*_No notes\._/);
  assert.doesNotMatch(md, /score|rating|recommend/i);
});

test('markdown without a date omits the date line', () => {
  const md = toMarkdown(startInterview(skills));
  assert.doesNotMatch(md, /Date:/);
});
