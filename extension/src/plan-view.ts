// Plan section of a candidate's page: an interview plan from the job's skills and their resume.
// Not a resume match: no score, no fit label, no ranking. It lists what the resume shows and what to ask.
import { $, el, toast, withBusy, errorMessage, type Nav } from './ui.ts';
import { getState, commit } from './data.ts';
import { api } from './api.ts';
import * as S from './store.ts';

let nav: Nav;
let candidateId = '';

export function initPlan(navigation: Nav): void {
  nav = navigation;
  $('prepMake').addEventListener('click', (e) => makePlan(e.currentTarget as HTMLButtonElement));
}

// Shows the plan for this candidate. candidate-view calls it on open and after every change.
export function renderPlanSection(id: string): void {
  candidateId = id;
  const state = getState();
  const cand = S.getCandidate(state, id);
  const job = cand && S.getJob(state, cand.jobId);
  if (!cand || !job) return;

  // What the plan will use, and what's missing.
  const missing: string[] = [];
  if (!job.skills.length) missing.push('the job’s skills checklist');
  if (!cand.resumeText) missing.push('the candidate’s resume');
  $('prepInputs').replaceChildren(
    el('li', {}, el('b', {}, 'Job: '), S.jobLabel(job), ` · ${job.skills.length} skills`),
    el('li', {}, el('b', {}, 'Resume: '), cand.resumeText ? `${cand.resumeText.split(/\s+/).length} words` : 'not added'),
  );
  const note = $('prepMissing');
  note.hidden = !missing.length;
  note.replaceChildren(
    `Add ${missing.join(' and ')} first. `,
    !job.skills.length
      ? el('button', { class: 'link-btn inline', type: 'button', onclick: () => nav.job(job.id) }, 'Open the job')
      : el('button', { class: 'link-btn inline', type: 'button', onclick: () => nav.editCandidate(cand.id) }, 'Add the resume'),
  );
  // The job's skills changed after this plan was made. Keep the old plan; making it again uses the new skills.
  $('prepStale').hidden = missing.length > 0 || !S.planOutOfDate(job, cand);
  const make = $<HTMLButtonElement>('prepMake');
  make.disabled = missing.length > 0;
  make.textContent = cand.plan ? 'Make the plan again' : 'Make interview plan';

  renderPlan(cand);
}

function renderPlan(cand: S.Candidate) {
  const view = $('prepPlan');
  const plan = cand.plan;
  if (!plan) {
    view.replaceChildren();
    view.hidden = true;
    return;
  }
  view.hidden = false;
  const parts: HTMLElement[] = [];
  if (plan.opening) parts.push(el('div', { class: 'plan-block' }, el('h3', {}, 'Start with'), el('p', { class: 'q' }, plan.opening)));

  parts.push(
    el('h3', {}, 'Skill by skill'),
    el(
      'ol',
      { class: 'plan-skills' },
      ...plan.skills.map((s) =>
        el(
          'li',
          {},
          el('b', {}, s.name),
          el('p', { class: 'evidence' }, el('span', { class: 'tag' }, 'Resume'), s.resumeShows || 'Not mentioned. Ask directly.'),
          s.askAbout ? el('p', { class: 'evidence' }, el('span', { class: 'tag' }, 'Find out'), s.askAbout) : null,
          ...s.questions.map((q) => el('p', { class: 'q' }, q)),
        ),
      ),
    ),
  );

  if (plan.verify?.length) {
    parts.push(
      el('h3', {}, 'Claims to check'),
      el(
        'ul',
        { class: 'plan-verify' },
        ...plan.verify.map((v) => el('li', {}, el('span', { class: 'claim' }, v.claim), el('p', { class: 'q' }, v.question))),
      ),
    );
  }
  parts.push(el('p', { class: 'help' }, 'This plan lists what the resume says and what to ask. It doesn’t rate the candidate; that’s your call after the interview.'));
  view.replaceChildren(...parts);
}

async function makePlan(button: HTMLButtonElement) {
  const state = getState();
  const cand = S.getCandidate(state, candidateId);
  const job = cand && S.getJob(state, cand.jobId);
  if (!cand || !job) return;
  await withBusy(button, 'Making the plan…', async () => {
    try {
      const { plan } = await api('/api/plan', {
        title: job.title,
        company: job.company,
        description: job.description,
        skills: job.skills,
        resumeText: cand.resumeText,
      });
      if (!(await commit(S.updateCandidate(getState(), cand.id, { plan: S.planForJob(plan, job) })))) return;
      toast('Plan ready. You’ll also see it in Interview.');
    } catch (err) {
      toast(errorMessage(err), { error: true });
    }
  });
}
