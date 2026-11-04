import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../lib/app.js';
import { parseJsonObject, cleanSkills, cleanFollowups, FOLLOWUP_SYSTEM } from '../lib/prompts.js';

const TOKEN = 'test-token';
const models = { fast: 'test-fast-model' };

// Starts the app on a random port and returns its base URL plus the calls it made to the fake AI.
async function start({ reply = '{}', fail = null, appToken = TOKEN } = {}) {
  const calls = [];
  const complete = async (args) => {
    calls.push(args);
    if (fail) throw fail;
    return typeof reply === 'function' ? reply(args) : reply;
  };
  const server = createApp({ complete, appToken, models });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, calls, close: () => new Promise((resolve) => server.close(resolve)) };
}

const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const post = (base, path, body, headers = auth) => fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });

test('health check works without a token', async () => {
  const app = await start();
  try {
    const res = await fetch(`${app.base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, service: 'debrief' });
  } finally {
    await app.close();
  }
});

test('API stays closed when no app token is configured', async () => {
  const app = await start({ appToken: '' });
  try {
    const res = await post(app.base, '/api/skills', { jobDescription: 'Backend engineer' }, auth);
    assert.equal(res.status, 503);
    assert.equal(app.calls.length, 0);
  } finally {
    await app.close();
  }
});

test('wrong or missing token is refused', async () => {
  const app = await start();
  try {
    const bad = await post(app.base, '/api/skills', { jobDescription: 'x' }, { Authorization: 'Bearer nope', 'Content-Type': 'application/json' });
    const none = await post(app.base, '/api/skills', { jobDescription: 'x' }, { 'Content-Type': 'application/json' });
    assert.equal(bad.status, 401);
    assert.equal(none.status, 401);
    assert.equal(app.calls.length, 0);
  } finally {
    await app.close();
  }
});

test('skills: turns a job description into a cleaned checklist with the fast model', async () => {
  const reply = 'Here you go: {"skills":[{"name":"  Node.js  ","why":"Build the API"},{"name":""},{"name":"SQL"}]}';
  const app = await start({ reply });
  try {
    const res = await post(app.base, '/api/skills', { jobDescription: 'We need a backend engineer.' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.skills, [
      { name: 'Node.js', why: 'Build the API' },
      { name: 'SQL', why: '' },
    ]);
    assert.equal(app.calls[0].model, 'test-fast-model');
    assert.match(app.calls[0].user, /backend engineer/);
  } finally {
    await app.close();
  }
});

test('skills: a missing job description is a clear 400', async () => {
  const app = await start();
  try {
    const res = await post(app.base, '/api/skills', { jobDescription: '   ' });
    assert.equal(res.status, 400);
    assert.equal(app.calls.length, 0);
  } finally {
    await app.close();
  }
});

test('follow-ups: keeps at most two real questions', async () => {
  const reply = '{"questions":["What did you build first?","Who signed off?","This is not a question","Third one?"]}';
  const app = await start({ reply });
  try {
    const res = await post(app.base, '/api/followups', { skill: 'Node.js', question: 'Tell me about a project', answer: 'I built an API.' });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).questions, ['What did you build first?', 'Who signed off?']);
  } finally {
    await app.close();
  }
});

test('follow-ups: missing skill or answer is a 400', async () => {
  const app = await start();
  try {
    const res = await post(app.base, '/api/followups', { skill: 'SQL', answer: '' });
    assert.equal(res.status, 400);
  } finally {
    await app.close();
  }
});

test('AI failure returns a friendly message and hides the raw error', async () => {
  const fail = Object.assign(new Error('secret upstream details'), { status: 500 });
  const app = await start({ fail });
  try {
    const res = await post(app.base, '/api/followups', { skill: 'SQL', answer: 'Yes.' });
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.error, 'ai_error');
    assert.doesNotMatch(JSON.stringify(body), /secret upstream/);
  } finally {
    await app.close();
  }
});

test('CORS: only the Debrief extension origin is allowed', async () => {
  const app = await start();
  try {
    const ext = await fetch(`${app.base}/health`, { headers: { Origin: 'chrome-extension://abcdefg' } });
    assert.equal(ext.headers.get('access-control-allow-origin'), 'chrome-extension://abcdefg');
    const web = await fetch(`${app.base}/health`, { headers: { Origin: 'https://example.com' } });
    assert.equal(web.headers.get('access-control-allow-origin'), null);
  } finally {
    await app.close();
  }
});

test('prompts: follow-up rules forbid judging the candidate', () => {
  assert.match(FOLLOWUP_SYSTEM, /Do not judge or score/);
  assert.match(FOLLOWUP_SYSTEM, /personal traits/);
});

test('helpers: parse JSON out of surrounding text and reject junk', () => {
  assert.deepEqual(parseJsonObject('note {"a":1} end'), { a: 1 });
  assert.equal(parseJsonObject('no json here'), null);
  assert.equal(parseJsonObject('{broken'), null);
  assert.deepEqual(cleanSkills(null), []);
  assert.deepEqual(cleanFollowups({ questions: ['not a question'] }), []);
});
