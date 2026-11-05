import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { SKILLS_SYSTEM, FOLLOWUP_SYSTEM, parseJsonObject, cleanSkills, cleanFollowups, skillsUser, followupUser, listOf, type Skill } from './prompts.ts';
import { PLAN_SYSTEM, planUser, cleanPlan } from './plan.ts';
import { RESUME_SYSTEM, MAX_PDF_BYTES, base64Bytes, resumeContent, resumeErrorMessage } from './resume.ts';
import { friendlyAiError, friendlySpeechError, userMessage, asErrorLike, MESSAGES } from './aierrors.ts';
import type { Complete } from './claude.ts';
import type { GrantKey } from './deepgram.ts';

export const LIMITS = {
  jobDescription: 20_000,
  answer: 8_000,
  skill: 200,
  question: 500,
  title: 120,
  resume: 30_000,
  bodyBytes: 128 * 1024,
  // Base64 makes a file about 4/3 bigger, plus the JSON around it.
  resumeBodyBytes: Math.ceil((MAX_PDF_BYTES * 4) / 3) + 4096,
};

export interface AppOptions {
  complete: Complete;
  grantKey?: GrantKey | null;
  appToken?: string;
  models: { fast: string; assist?: string };
}

type Body = Record<string, unknown>;

// Only the Debrief extension may call the API from a browser (any other site is refused).
function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !origin.startsWith('chrome-extension://')) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

function send(res: http.ServerResponse, status: number, body: unknown, origin: string | undefined): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
  res.end(JSON.stringify(body));
}

// Errors about the request itself (not the AI): `local` keeps them apart from provider errors with the same status.
const requestError = (status: number, message: string) => Object.assign(new Error(message), { status, local: true });

async function readJson(req: http.IncomingMessage, maxBytes = LIMITS.bodyBytes): Promise<Body> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw requestError(413, 'That is too large to send.');
    chunks.push(chunk);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw requestError(400, MESSAGES.request);
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Body) : {};
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function tokenMatches(header: string | undefined, appToken: string): boolean {
  const given = Buffer.from(String(header || ''));
  const wanted = Buffer.from(`Bearer ${appToken}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

function skillsFrom(value: unknown): Skill[] {
  return listOf(value)
    .map((s) => ({ name: text(s?.name, 80), why: text(s?.why, 200) }))
    .filter((s) => s.name)
    .slice(0, 12);
}

// createApp({ complete, grantKey, appToken, models }) → http.Server
// complete({model, system, user, maxTokens}) → reply text. grantKey() → { key, expiresIn }. Both injected so
// tests can fake the AI and Deepgram. models = { fast, assist }.
export function createApp({ complete, grantKey, appToken = '', models }: AppOptions): http.Server {
  const assist = models.assist || models.fast;

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(origin));
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'debrief' }, origin);
    }

    // Everything below needs the app token. Without one configured, the API stays closed.
    if (!appToken) return send(res, 503, { error: 'not_configured', message: MESSAGES.unavailable }, origin);
    if (!tokenMatches(req.headers.authorization, appToken)) {
      return send(res, 401, { error: 'unauthorized', message: 'The app token is wrong. Check it in Settings.' }, origin);
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

      if (req.method === 'POST' && url.pathname === '/api/plan') {
        const body = await readJson(req);
        const skills = skillsFrom(body.skills);
        const resumeText = text(body.resumeText, LIMITS.resume);
        if (!skills.length) return send(res, 400, { error: 'missing_skills', message: 'Add the job’s skills first (Jobs → the job → Make checklist).' }, origin);
        if (!resumeText) return send(res, 400, { error: 'missing_resume', message: 'Add the candidate’s resume first.' }, origin);
        const user = planUser({
          title: text(body.title, LIMITS.title) || 'Untitled job',
          company: text(body.company, LIMITS.title),
          description: text(body.description, LIMITS.jobDescription),
          skills,
          resumeText,
        });
        const reply = await complete({ model: assist, system: PLAN_SYSTEM, user, maxTokens: 2500 });
        const parsed = parseJsonObject(reply);
        if (!parsed) return send(res, 502, { error: 'ai_error', message: 'We couldn’t make the plan just now. Please try again.' }, origin);
        return send(res, 200, { plan: cleanPlan(parsed, skills) }, origin);
      }

      if (req.method === 'POST' && url.pathname === '/api/resume/parse') {
        const body = await readJson(req, LIMITS.resumeBodyBytes);
        const pdfBase64 = typeof body.pdfBase64 === 'string' ? body.pdfBase64 : '';
        if (!pdfBase64) return send(res, 400, { error: 'missing_file', message: 'We didn’t receive a file. Please choose the PDF again.' }, origin);
        if (base64Bytes(pdfBase64) > MAX_PDF_BYTES) return send(res, 413, { error: 'too_large', message: 'That PDF is over 8 MB. Try a smaller file, or paste the resume text instead.' }, origin);
        let reply: string;
        try {
          reply = await complete({ model: models.fast, system: RESUME_SYSTEM, user: resumeContent(pdfBase64), maxTokens: 6000 });
        } catch (err) {
          const e = asErrorLike(err);
          console.error('[resume] could not read PDF:', e.status || '', e.message || err);
          return send(res, 502, { error: 'resume_unreadable', message: resumeErrorMessage(err) }, origin);
        }
        const resumeText = reply.trim();
        if (!resumeText) return send(res, 422, { error: 'resume_empty', message: 'We couldn’t find any text in that PDF. If it’s a scanned image, paste the resume text instead.' }, origin);
        return send(res, 200, { text: resumeText.slice(0, LIMITS.resume) }, origin);
      }

      if (req.method === 'POST' && url.pathname === '/api/transcribe-token') {
        if (!grantKey) return send(res, 503, { error: 'not_configured', message: 'Live transcription isn’t set up on the server yet.' }, origin);
        // Speech errors get speech wording (not the AI's), and the cause goes to the server log.
        let grant;
        try {
          grant = await grantKey();
        } catch (err) {
          return send(res, 502, { error: 'speech_error', message: friendlySpeechError(err) }, origin);
        }
        return send(res, 200, { key: grant.key, expiresIn: grant.expiresIn }, origin);
      }

      return send(res, 404, { error: 'not_found' }, origin);
    } catch (err) {
      const e = asErrorLike(err);
      if (e.local) return send(res, e.status ?? 400, { error: e.status === 413 ? 'too_large' : 'bad_request', message: e.message }, origin);
      const message = userMessage(friendlyAiError(err), MESSAGES.generic);
      return send(res, 502, { error: 'ai_error', message }, origin);
    }
  });
}
