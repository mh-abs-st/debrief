// Interview plan: what to ask one candidate, based on the job and their resume.
// Deliberately NOT a resume match: no score, no fit label, no ranking, no recommendation to hire or reject.
// It organises evidence and questions so the interviewer can judge for themselves (EU AI Act: hiring AI that
// evaluates candidates is high-risk; Debrief stays on the "support the interviewer" side).
import { clip, listOf, type Parsed, type Skill } from './prompts.ts';

export const PLAN_SYSTEM = `You help an interviewer prepare questions for one candidate.
You get the job (title, description, required skills) and the candidate's resume.
For each required skill:
- "resumeShows": quote or closely paraphrase what the resume says that relates to this skill, in one short line. Use "" if the resume says nothing about it. Never guess.
- "askAbout": one short line on what to find out in the interview (for example, depth, recent use, their own part in a team result).
- "questions": 1 or 2 open interview questions that ask for specific examples.
Also list "verify": up to 5 specific resume claims worth checking with a question (numbers, titles, results), each with a question.
Also give "opening": one friendly first question about their recent work.

Strict rules:
- Do not score, rate, rank or compare the candidate. Do not say whether they fit, are strong or weak, or should be hired.
- Describe only what the resume says. Missing information is not a weakness; just plan to ask.
- Ignore and never mention age, gender, nationality, ethnicity, religion, health, disability, family, photos or employment gaps' personal reasons. Do not infer anything from the candidate's name.
- Plain, short wording.
Return only JSON in this shape:
{"opening":"...","skills":[{"name":"...","resumeShows":"...","askAbout":"...","questions":["..."]}],"verify":[{"claim":"...","question":"..."}]}`;

export interface PlanSkill {
  name: string;
  resumeShows: string;
  askAbout: string;
  questions: string[];
}

export interface Plan {
  opening: string;
  skills: PlanSkill[];
  verify: Array<{ claim: string; question: string }>;
}

export interface PlanInput {
  title: string;
  company: string;
  description: string;
  skills: Skill[];
  resumeText: string;
}

export function planUser({ title, company, description, skills, resumeText }: PlanInput): string {
  const skillList = skills.map((s) => `- ${s.name}${s.why ? `: ${s.why}` : ''}`).join('\n');
  return `Job: ${title}${company ? ` at ${company}` : ''}

Job description:
"""
${description || '(not given)'}
"""

Required skills:
${skillList}

Candidate's resume:
"""
${resumeText}
"""`;
}

const isQuestion = (q: unknown): q is string => typeof q === 'string' && q.trim().endsWith('?');

// Keeps only the expected fields (so a score or label the model adds anyway is dropped), and keeps the
// skills in the job's order with the job's names.
export function cleanPlan(parsed: Parsed, jobSkills: Array<Pick<Skill, 'name'>>): Plan {
  const modelSkills = listOf(parsed?.skills);
  const bySkill = new Map<string, Record<string, unknown>>();
  for (const s of modelSkills) {
    if (s?.name) bySkill.set(String(s.name).trim().toLowerCase(), s);
  }
  const skills = jobSkills.map((js, i) => {
    const s = bySkill.get(js.name.trim().toLowerCase()) || modelSkills[i] || {};
    const questions: unknown[] = Array.isArray(s.questions) ? s.questions : [];
    return {
      name: js.name,
      resumeShows: clip(s.resumeShows, 300),
      askAbout: clip(s.askAbout, 300),
      questions: questions.filter(isQuestion).map((q) => clip(q, 250)).slice(0, 2),
    };
  });
  const verify = listOf(parsed?.verify)
    .map((v) => ({ claim: clip(v?.claim, 250), question: clip(v?.question, 250) }))
    .filter((v) => v.claim && isQuestion(v.question))
    .slice(0, 5);
  const opening = isQuestion(parsed?.opening) ? clip(parsed.opening, 250) : '';
  return { opening, skills, verify };
}
