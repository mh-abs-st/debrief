import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../lib/app.js';
import { cleanPlan, PLAN_SYSTEM } from '../lib/plan.js';
import { RESUME_SYSTEM } from '../lib/resume.js';

const TOKEN = 'test-token';
const models = { fast: 'fast-model', assist: 'assist-model' };
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function start({ reply = '{}', fail = null } = {}) {
  const calls = [];
  const complete = async (args) => {
    calls.push(args);
    if (fail) throw fail;
    return reply;
  };
  const server = createApp({ complete, appToken: TOKEN, models });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
  return { post, calls, close: () => new Promise((r) => server.close(r)) };
}

const skills = [{ name: 'Node.js', why: 'Build the API' }, { name: 'SQL' }];

test('plan: uses the assist model and returns a cleaned plan', async () => {
  const reply = JSON.stringify({
    fitScore: 82,
    fitLabel: 'Strong fit',
    opening: 'What have you been working on lately?',
    skills: [
      { name: 'sql', resumeShows: 'Postgres at Acme', askAbout: 'Query tuning depth', questions: ['How did you speed up a slow query?', 'not a question'] },
      { name: 'Node.js', resumeShows: '', askAbout: 'Not on the resume; ask directly', questions: ['Have you built a Node service?'] },
    ],
    verify: [{ claim: 'Cut costs 40%', question: 'How did you measure the 40%?' }, { claim: 'x', question: 'no question mark' }],
  });
  const app = await start({ reply });
  try {
    const res = await app.post('/api/plan', { title: 'Backend', skills, resumeText: 'Postgres at Acme' });
    assert.equal(res.status, 200);
    const { plan } = await res.json();
    assert.equal(app.calls[0].model, 'assist-model');
    assert.equal(plan.opening, 'What have you been working on lately?');
    // Job order and job names are kept, whatever order the model used.
    assert.deepEqual(plan.skills.map((s) => s.name), ['Node.js', 'SQL']);
    assert.deepEqual(plan.skills[1].questions, ['How did you speed up a slow query?']);
    assert.equal(plan.verify.length, 1);
    // Scores and labels the model adds anyway never reach the panel.
    assert.doesNotMatch(JSON.stringify(plan), /fitScore|Strong fit|82/);
  } finally {
    await app.close();
  }
});

test('plan: missing skills or resume are clear 400s and cost no AI call', async () => {
  const app = await start();
  try {
    assert.equal((await app.post('/api/plan', { skills: [], resumeText: 'x' })).status, 400);
    assert.equal((await app.post('/api/plan', { skills, resumeText: '  ' })).status, 400);
    assert.equal(app.calls.length, 0);
  } finally {
    await app.close();
  }
});

test('plan: a reply with no JSON is a friendly 502', async () => {
  const app = await start({ reply: 'Sorry, I cannot help.' });
  try {
    const res = await app.post('/api/plan', { skills, resumeText: 'x' });
    assert.equal(res.status, 502);
    assert.match((await res.json()).message, /couldn’t make the plan/);
  } finally {
    await app.close();
  }
});

test('plan prompt forbids scoring and protected traits', () => {
  assert.match(PLAN_SYSTEM, /Do not score, rate, rank or compare/);
  assert.match(PLAN_SYSTEM, /age, gender, nationality/);
  assert.match(PLAN_SYSTEM, /name/);
});

test('cleanPlan fills every job skill even when the model skips some', () => {
  const plan = cleanPlan({ skills: [] }, skills);
  assert.deepEqual(plan.skills.map((s) => s.name), ['Node.js', 'SQL']);
  assert.equal(plan.skills[0].resumeShows, '');
});

test('resume: sends the PDF as a document block and returns the text', async () => {
  const app = await start({ reply: '  Ana Example\n- Node.js, 5 years  ' });
  try {
    const res = await app.post('/api/resume/parse', { pdfBase64: Buffer.from('%PDF-1.4 test').toString('base64') });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).text, 'Ana Example\n- Node.js, 5 years');
    const content = app.calls[0].user;
    assert.equal(content[0].type, 'document');
    assert.equal(content[0].source.media_type, 'application/pdf');
  } finally {
    await app.close();
  }
});

test('resume: missing file, empty text and password PDFs get clear messages', async () => {
  const empty = await start({ reply: '   ' });
  try {
    assert.equal((await empty.post('/api/resume/parse', {})).status, 400);
    const res = await empty.post('/api/resume/parse', { pdfBase64: 'JVBERg==' });
    assert.equal(res.status, 422);
  } finally {
    await empty.close();
  }
  const locked = await start({ fail: Object.assign(new Error('PDF is encrypted'), { status: 400 }) });
  try {
    const res = await locked.post('/api/resume/parse', { pdfBase64: 'JVBERg==' });
    assert.equal(res.status, 502);
    assert.match((await res.json()).message, /password-protected/);
  } finally {
    await locked.close();
  }
});

test('resume prompt drops personal details that must not influence hiring', () => {
  assert.match(RESUME_SYSTEM, /date of birth, age, marital status, nationality/);
});

test('an AI error with status 400 is not reported as the panel’s fault', async () => {
  const app = await start({ fail: Object.assign(new Error('invalid_request_error'), { status: 400 }) });
  try {
    const res = await app.post('/api/followups', { skill: 'SQL', answer: 'Yes.' });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, 'ai_error');
  } finally {
    await app.close();
  }
});
