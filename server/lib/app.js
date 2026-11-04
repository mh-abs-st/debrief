import http from 'node:http';
import { SKILLS_SYSTEM, FOLLOWUP_SYSTEM, parseJsonObject, cleanSkills, cleanFollowups, skillsUser, followupUser } from './prompts.js';
import { friendlyAiError, userMessage, MESSAGES } from './aierrors.js';

export const LIMITS = { jobDescription: 20_000, answer: 8_000, skill: 200, question: 500, bodyBytes: 64 * 1024 };

// Only the Debrief extension may call the API from a browser (any other site is refused).
function corsHeaders(origin) {
  if (!origin || !origin.startsWith('chrome-extension://')) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function send(res, status, body, origin) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > LIMITS.bodyBytes) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('bad json'), { status: 400 });
  }
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// createApp({ complete, appToken, models }) → http.Server
// complete({model, system, user, maxTokens}) → reply text. Injected so tests can fake the AI.
export function createApp({ complete, appToken = '', models }) {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(origin));
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'debrief' }, origin);
    }

    // Everything below needs the app token. Without one configured, the API stays closed.
    if (!appToken) return send(res, 503, { error: 'not_configured', message: MESSAGES.unavailable }, origin);
    if (req.headers.authorization !== `Bearer ${appToken}`) {
      return send(res, 401, { error: 'unauthorized', message: 'Please sign in again.' }, origin);
    }

    try {
      if (req.method === 'POST' && url.pathname === '/api/skills') {
        const body = await readJson(req);
        const jobDescription = text(body.jobDescription, LIMITS.jobDescription);
        if (!jobDescription) return send(res, 400, { error: 'missing_job', message: 'Paste the job description first.' }, origin);
        const reply = await complete({ model: models.fast, system: SKILLS_SYSTEM, user: skillsUser(jobDescription), maxTokens: 700 });
        return send(res, 200, { skills: cleanSkills(parseJsonObject(reply)) }, origin);
      }

      if (req.method === 'POST' && url.pathname === '/api/followups') {
        const body = await readJson(req);
        const skill = text(body.skill, LIMITS.skill);
        const answer = text(body.answer, LIMITS.answer);
        const question = text(body.question, LIMITS.question);
        if (!skill || !answer) return send(res, 400, { error: 'missing_fields', message: 'Add the skill and the answer first.' }, origin);
        const reply = await complete({ model: models.fast, system: FOLLOWUP_SYSTEM, user: followupUser({ skill, question, answer }), maxTokens: 300 });
        return send(res, 200, { questions: cleanFollowups(parseJsonObject(reply)) }, origin);
      }

      return send(res, 404, { error: 'not_found' }, origin);
    } catch (err) {
      if (err?.status === 413) return send(res, 413, { error: 'too_large', message: 'That text is too long.' }, origin);
      if (err?.status === 400) return send(res, 400, { error: 'bad_request', message: MESSAGES.request }, origin);
      const message = userMessage(friendlyAiError(err), MESSAGES.generic);
      return send(res, 502, { error: 'ai_error', message }, origin);
    }
  });
}
