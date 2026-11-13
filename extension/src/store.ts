// Debrief's data: jobs, the candidates for each job, and the interviews (your notes) for each candidate.
// Pure functions only (no Chrome or DOM), so they can be tested in Node. Every function returns a new state.
// Everything is saved on the interviewer's computer (chrome.storage.local), never on the server.

export const STAGES = ['new', 'scheduled', 'interviewed', 'decided'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = { new: 'New', scheduled: 'Scheduled', interviewed: 'Interviewed', decided: 'Decided' };

export const LIMITS = { title: 120, company: 120, description: 20_000, name: 120, email: 200, url: 500, resume: 30_000, notes: 10_000 };

export interface Skill {
  name: string;
  why: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  skills: Skill[];
  status: 'open' | 'closed';
  createdAt: number;
  updatedAt: number;
}

// The interview plan from the server (see server/lib/plan.ts). No score, no fit label.
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
  // The job's skill names when the plan was made, so we can tell when they've changed since.
  // Plans saved before this field existed don't have it.
  madeFromSkills?: string[];
}

export interface Candidate {
  id: string;
  jobId: string;
  name: string;
  email: string;
  profileUrl: string;
  resumeText: string;
  stage: Stage;
  interviewAt: string;
  plan: Plan | null;
  createdAt: number;
  updatedAt: number;
}

export interface InterviewSkill extends Skill {
  covered: boolean;
  notes: string;
}

export interface Interview {
  id: string;
  jobId: string;
  candidateId: string;
  startedAt: number;
  endedAt: number | null;
  skills: InterviewSkill[];
  generalNotes: string;
}

export interface State {
  jobs: Job[];
  candidates: Candidate[];
  interviews: Interview[];
}

// What the job and candidate forms send. Every field is optional and cleaned before it is stored.
export interface JobFields {
  title?: string;
  company?: string;
  description?: string;
  skills?: Array<{ name?: string; why?: string }>;
  status?: string;
}

export interface CandidateFields {
  name?: string;
  email?: string;
  profileUrl?: string;
  resumeText?: string;
  stage?: string;
  interviewAt?: string;
  plan?: Plan | null;
}

export const isStage = (value: unknown): value is Stage => (STAGES as readonly unknown[]).includes(value);

export function emptyState(): State {
  return { jobs: [], candidates: [], interviews: [] };
}

// Makes sure stored data has the expected shape (older or damaged data never breaks the panel).
export function normalize(raw: unknown): State {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof State, unknown>>;
  return {
    jobs: Array.isArray(s.jobs) ? s.jobs : [],
    candidates: Array.isArray(s.candidates) ? s.candidates : [],
    interviews: Array.isArray(s.interviews) ? s.interviews : [],
  };
}

let counter = 0;
export function newId(prefix: string, now: number = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${now.toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const clip = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

// Only http(s) links are kept, so a pasted "javascript:" link can never be opened.
export function cleanUrl(value: unknown): string {
  const v = clip(value, LIMITS.url);
  if (!v) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function cleanSkills(skills: unknown): Skill[] {
  return (Array.isArray(skills) ? (skills as Array<{ name?: unknown; why?: unknown } | null>) : [])
    .map((s) => ({ name: clip(s?.name, 80), why: clip(s?.why, 200) }))
    .filter((s) => s.name)
    .slice(0, 12);
}

// ---------- Jobs ----------

export function addJob(state: State, fields: JobFields, now: number = Date.now()): { state: State; job: Job } {
  const job: Job = {
    id: newId('job', now),
    title: clip(fields.title, LIMITS.title) || 'Untitled job',
    company: clip(fields.company, LIMITS.company),
    description: clip(fields.description, LIMITS.description),
    skills: cleanSkills(fields.skills),
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  return { state: { ...state, jobs: [...state.jobs, job] }, job };
}

export function updateJob(state: State, id: string, fields: JobFields, now: number = Date.now()): State {
  const jobs = state.jobs.map((j) => {
    if (j.id !== id) return j;
    const next = { ...j, updatedAt: now };
    if ('title' in fields) next.title = clip(fields.title, LIMITS.title) || 'Untitled job';
    if ('company' in fields) next.company = clip(fields.company, LIMITS.company);
    if ('description' in fields) next.description = clip(fields.description, LIMITS.description);
    if ('skills' in fields) next.skills = cleanSkills(fields.skills);
    if ('status' in fields) next.status = fields.status === 'closed' ? 'closed' : 'open';
    return next;
  });
  return { ...state, jobs };
}

// Deleting a job deletes its candidates and their interview notes too.
export function removeJob(state: State, id: string): State {
  return {
    jobs: state.jobs.filter((j) => j.id !== id),
    candidates: state.candidates.filter((c) => c.jobId !== id),
    interviews: state.interviews.filter((i) => i.jobId !== id),
  };
}

export function getJob(state: State, id: string | null | undefined): Job | null {
  return state.jobs.find((j) => j.id === id) || null;
}

export function jobsByStatus(state: State, status: string = 'open'): Job[] {
  const list = status === 'all' ? state.jobs : state.jobs.filter((j) => j.status === status);
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function jobLabel(job: Job | null | undefined): string {
  if (!job) return '';
  return job.company ? `${job.title} · ${job.company}` : job.title;
}

// ---------- Candidates ----------

export function addCandidate(state: State, jobId: string, fields: CandidateFields, now: number = Date.now()): { state: State; candidate: Candidate } {
  if (!getJob(state, jobId)) throw new Error('That job no longer exists.');
  const candidate: Candidate = {
    id: newId('cand', now),
    jobId,
    name: clip(fields.name, LIMITS.name) || 'Unnamed candidate',
    email: clip(fields.email, LIMITS.email),
    profileUrl: cleanUrl(fields.profileUrl),
    resumeText: clip(fields.resumeText, LIMITS.resume),
    stage: 'new',
    interviewAt: clip(fields.interviewAt, 40),
    plan: null,
    createdAt: now,
    updatedAt: now,
  };
  // A stage you chose wins; otherwise a date means the interview is scheduled.
  candidate.stage = isStage(fields.stage) ? fields.stage : candidate.interviewAt ? 'scheduled' : 'new';
  return { state: { ...state, candidates: [...state.candidates, candidate] }, candidate };
}

export function updateCandidate(state: State, id: string, fields: CandidateFields, now: number = Date.now()): State {
  const candidates = state.candidates.map((c) => {
    if (c.id !== id) return c;
    const next = { ...c, updatedAt: now };
    if ('name' in fields) next.name = clip(fields.name, LIMITS.name) || 'Unnamed candidate';
    if ('email' in fields) next.email = clip(fields.email, LIMITS.email);
    if ('profileUrl' in fields) next.profileUrl = cleanUrl(fields.profileUrl);
    if ('resumeText' in fields) {
      next.resumeText = clip(fields.resumeText, LIMITS.resume);
      if (next.resumeText !== c.resumeText) next.plan = null; // a new resume needs a new plan
    }
    if ('stage' in fields && isStage(fields.stage)) next.stage = fields.stage;
    if ('interviewAt' in fields) next.interviewAt = clip(fields.interviewAt, 40);
    // Adding a date to a New candidate schedules them, unless a stage was chosen in the same change.
    // Other stages stay as they are: a date added to someone Interviewed or Decided doesn't move them back.
    if (!c.interviewAt && next.interviewAt && next.stage === 'new' && !isStage(fields.stage)) next.stage = 'scheduled';
    if ('plan' in fields) next.plan = fields.plan || null;
    return next;
  });
  return { ...state, candidates };
}

// A plan from the server, marked with the job's skills it was made from.
export function planForJob(plan: Plan, job: Job): Plan {
  return { ...plan, madeFromSkills: job.skills.map((sk) => sk.name) };
}

// True when the job's skills changed after this candidate's plan was made: one added, removed or renamed.
// Order and capitals don't count. Older plans without madeFromSkills use the skills the plan lists,
// which the server keeps in the job's names (server/lib/plan.ts).
export function planOutOfDate(job: Job, cand: Candidate): boolean {
  if (!cand.plan) return false;
  const key = (names: string[]) => names.map((n) => n.trim().toLowerCase()).sort().join('\n');
  const madeFrom = cand.plan.madeFromSkills ?? cand.plan.skills.map((sk) => sk.name);
  return key(madeFrom) !== key(job.skills.map((sk) => sk.name));
}

// Deleting a candidate deletes everything about them: profile, resume, plan and interview notes.
export function removeCandidate(state: State, id: string): State {
  return {
    ...state,
    candidates: state.candidates.filter((c) => c.id !== id),
    interviews: state.interviews.filter((i) => i.candidateId !== id),
  };
}

export function getCandidate(state: State, id: string | null | undefined): Candidate | null {
  return state.candidates.find((c) => c.id === id) || null;
}

export function candidatesFor(state: State, jobId: string): Candidate[] {
  return state.candidates.filter((c) => c.jobId === jobId).sort((a, b) => a.createdAt - b.createdAt);
}

// ---------- Interviews (your notes for one call) ----------

// Starts a new interview for a candidate, with the job's skills as the checklist.
export function startInterview(state: State, candidateId: string, now: number = Date.now()): { state: State; interview: Interview } {
  const candidate = getCandidate(state, candidateId);
  if (!candidate) throw new Error('That candidate no longer exists.');
  const job = getJob(state, candidate.jobId);
  const interview: Interview = {
    id: newId('iv', now),
    jobId: candidate.jobId,
    candidateId,
    startedAt: now,
    endedAt: null,
    skills: (job?.skills || []).map((s) => ({ name: s.name, why: s.why || '', covered: false, notes: '' })),
    generalNotes: '',
  };
  return { state: { ...state, interviews: [...state.interviews, interview] }, interview };
}

export function updateInterview(state: State, id: string, change: (iv: Interview) => Interview): State {
  const interviews = state.interviews.map((iv) => (iv.id === id ? change(iv) : iv));
  return { ...state, interviews };
}

export function setSkillCovered(state: State, interviewId: string, index: number, covered: boolean): State {
  return updateInterview(state, interviewId, (iv) => ({
    ...iv,
    skills: iv.skills.map((s, i) => (i === index ? { ...s, covered: Boolean(covered) } : s)),
  }));
}

export function setSkillNotes(state: State, interviewId: string, index: number, notes: string): State {
  return updateInterview(state, interviewId, (iv) => ({
    ...iv,
    skills: iv.skills.map((s, i) => (i === index ? { ...s, notes: clip(notes, LIMITS.notes) } : s)),
  }));
}

export function setGeneralNotes(state: State, interviewId: string, notes: string): State {
  return updateInterview(state, interviewId, (iv) => ({ ...iv, generalNotes: clip(notes, LIMITS.notes) }));
}

// Ending an interview also moves the candidate to "Interviewed" (unless already decided).
export function endInterview(state: State, interviewId: string, now: number = Date.now()): State {
  const iv = state.interviews.find((i) => i.id === interviewId);
  if (!iv) return state;
  let next = updateInterview(state, interviewId, (x) => ({ ...x, endedAt: x.endedAt || now }));
  const c = getCandidate(next, iv.candidateId);
  if (c && c.stage !== 'decided') next = updateCandidate(next, c.id, { stage: 'interviewed' }, now);
  return next;
}

export function interviewsFor(state: State, candidateId: string): Interview[] {
  return state.interviews.filter((i) => i.candidateId === candidateId).sort((a, b) => b.startedAt - a.startedAt);
}

// The open (not ended) interview for a candidate, if any.
export function openInterview(state: State, candidateId: string): Interview | null {
  return interviewsFor(state, candidateId).find((i) => !i.endedAt) || null;
}

export function coverage(interview: Interview | null | undefined): { covered: number; total: number } {
  const total = interview?.skills?.length || 0;
  const covered = (interview?.skills || []).filter((s) => s.covered).length;
  return { covered, total };
}

// ---------- Upcoming (who you're interviewing next) ----------

// 'YYYY-MM-DD' for a date in the interviewer's own time zone (interviewAt is stored as local 'YYYY-MM-DDTHH:mm').
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface UpcomingGroups {
  inProgress: Candidate[]; // an interview was started and not ended
  today: Candidate[];
  later: Candidate[];
  earlier: Candidate[]; // the date has passed but they haven't been interviewed yet
  unscheduled: Candidate[]; // no interview date yet
}

// Candidates of open jobs who still need an interview, grouped by when. today = localDateKey(new Date()).
// Candidates already interviewed or decided are left out (they stay in Jobs), unless an interview is running.
export function upcoming(state: State, today: string): UpcomingGroups {
  const groups: UpcomingGroups = { inProgress: [], today: [], later: [], earlier: [], unscheduled: [] };
  const openJobs = new Set(state.jobs.filter((j) => j.status === 'open').map((j) => j.id));
  for (const c of state.candidates) {
    if (!openJobs.has(c.jobId)) continue;
    if (openInterview(state, c.id)) groups.inProgress.push(c);
    else if (c.stage === 'interviewed' || c.stage === 'decided') continue;
    else if (!c.interviewAt) groups.unscheduled.push(c);
    else {
      const day = c.interviewAt.slice(0, 10);
      groups[day === today ? 'today' : day > today ? 'later' : 'earlier'].push(c);
    }
  }
  const byTime = (a: Candidate, b: Candidate) => a.interviewAt.localeCompare(b.interviewAt);
  groups.today.sort(byTime);
  groups.later.sort(byTime);
  groups.earlier.sort((a, b) => byTime(b, a)); // most recent first
  groups.unscheduled.sort((a, b) => a.createdAt - b.createdAt);
  return groups;
}

// The candidate the Interview tab shows. In order: the interview that is running (the most recently
// started, if several), the candidate you chose (`chosen`, if they still exist), then the next one due
// today or later. '' when there is no one.
export function currentCandidateId(state: State, today: string, chosen = ''): string {
  const running = state.interviews
    .filter((iv) => !iv.endedAt && getCandidate(state, iv.candidateId))
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (running) return running.candidateId;
  if (chosen && getCandidate(state, chosen)) return chosen;
  const g = upcoming(state, today);
  return (g.today[0] || g.later[0])?.id || '';
}

// ---------- Retention (GDPR: don't keep candidate data longer than needed) ----------

// Removes candidates (and their notes) not changed for more than `days`. days = 0 means keep until deleted.
// Returns { state, removed } so the panel can say how many were removed.
export function purgeExpired(state: State, days: number, now: number = Date.now()): { state: State; removed: number } {
  if (!days || days <= 0) return { state, removed: 0 };
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const lastTouched = (c: Candidate) => {
    const ivTimes = state.interviews.filter((i) => i.candidateId === c.id).map((i) => i.endedAt || i.startedAt);
    return Math.max(c.updatedAt || 0, ...ivTimes);
  };
  const expired = new Set(state.candidates.filter((c) => lastTouched(c) < cutoff).map((c) => c.id));
  if (!expired.size) return { state, removed: 0 };
  return {
    state: {
      ...state,
      candidates: state.candidates.filter((c) => !expired.has(c.id)),
      interviews: state.interviews.filter((i) => !expired.has(i.candidateId)),
    },
    removed: expired.size,
  };
}

// ---------- Export ----------

// Markdown notes for one interview: only what the interviewer wrote. Debrief adds no assessment.
export function interviewMarkdown(state: State, interviewId: string): string {
  const iv = state.interviews.find((i) => i.id === interviewId);
  if (!iv) return '';
  const job = getJob(state, iv.jobId);
  const cand = getCandidate(state, iv.candidateId);
  const { covered, total } = coverage(iv);
  const date = new Date(iv.startedAt).toISOString().slice(0, 10);
  const lines = [`# Interview notes: ${cand?.name || 'Candidate'}`, ''];
  if (job) lines.push(`Job: ${jobLabel(job)}`);
  lines.push(`Date: ${date}`, `Skills covered: ${covered} of ${total}`, '');
  for (const s of iv.skills) {
    lines.push(`## ${s.name}`, '', `- Covered: ${s.covered ? 'yes' : 'no'}`, '', s.notes.trim() || '_No notes._', '');
  }
  if (iv.generalNotes.trim()) lines.push('## Other notes', '', iv.generalNotes.trim(), '');
  return lines.join('\n').trimEnd() + '\n';
}
