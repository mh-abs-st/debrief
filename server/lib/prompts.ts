// Prompts and output checks for Debrief's two AI features.
// Rule for every prompt: describe the job and the question, never rate or judge the candidate.

export const SKILLS_SYSTEM = `You help an interviewer prepare for a job interview.
Read the job description and list the skills and experience the role requires.
Return only JSON in this shape: {"skills":[{"name":"short skill name","why":"one short line from the job description"}]}
Use 3 to 8 items. Describe the job only. Do not rate, score or judge anyone.`;

export const FOLLOWUP_SYSTEM = `You help an interviewer ask good follow-up questions during a live interview.
You get one required skill, the question that was asked, and the candidate's answer.
Suggest up to 2 short follow-up questions that ask for specific evidence: what they did, what they decided, what happened.
Rules:
- One sentence per question. Plain, friendly wording.
- Do not judge or score the answer, and do not say whether it was good.
- Do not guess about the candidate's personality, background, age, family, health, religion or other personal traits, and do not ask about them.
Return only JSON in this shape: {"questions":["..."]}`;

export interface Skill {
  name: string;
  why: string;
}

// Parsed model output: untrusted JSON, so every field is checked before use.
export type Parsed = Record<string, unknown> | null;

// Pulls the first JSON object out of a model reply. Returns null if there isn't one.
export function parseJsonObject(text: unknown): Parsed {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const value: unknown = JSON.parse(match[0]);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Short, single-line text from any value (model output or request body).
export const clip = (value: unknown, max: number): string => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// The value as an array of loosely typed objects, or [] when it isn't an array.
export const listOf = (value: unknown): Array<Record<string, unknown> | undefined> => (Array.isArray(value) ? value : []);

export function cleanSkills(parsed: Parsed): Skill[] {
  return listOf(parsed?.skills)
    .map((s) => ({ name: clip(s?.name, 80), why: clip(s?.why, 200) }))
    .filter((s) => s.name)
    .slice(0, 8);
}

export function cleanFollowups(parsed: Parsed): string[] {
  const list: unknown[] = Array.isArray(parsed?.questions) ? parsed.questions : [];
  return list
    .map((q) => clip(q, 200))
    .filter((q) => q.endsWith('?'))
    .slice(0, 2);
}

export function skillsUser(jobDescription: string): string {
  return `Job description:\n"""\n${jobDescription}\n"""`;
}

export function followupUser({ skill, question, answer }: { skill: string; question: string; answer: string }): string {
  return `Required skill: ${skill}\nQuestion asked: ${question || '(not given)'}\nCandidate's answer:\n"""\n${answer}\n"""`;
}
