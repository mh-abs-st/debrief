// Prepare tab: an interview plan for one candidate, from the job's skills and their resume.
// Not a resume match: no score, no fit label, no ranking. It lists what the resume shows and what to ask.
import { $, el, toast, withBusy, errorMessage, type GoTo } from './ui.ts';
import { getState, commit, subscribe } from './data.ts';
import { api } from './api.ts';
import { createPicker, type Picker } from './picker.ts';
import * as S from './store.ts';

let picker: Picker;
let goTo: GoTo = () => {};

export function initPrepare({ onGo }: { onGo: GoTo }): void {
  goTo = onGo;
  picker = createPicker($('prepPicker'), { onChange: render });
  $('prepMake').addEventListener('click', (e) => makePlan(e.currentTarget as HTMLButtonElement));
  subscribe(() => {
    picker.refresh();
    render();
  });
  picker.refresh();
  render();
}

export function selectForPrepare(jobId: string | null | undefined, candidateId: string | null | undefined): void {
  picker.set(jobId, candidateId);
  render();
}

function render() {
  const state = getState();
  const { jobId, candidateId } = picker.get();
  const job = S.getJob(state, jobId);
  const cand = S.getCandidate(state, candidateId);

  const empty = $('prepEmpty');
  const body = $('prepBody');
  if (!job || !cand) {
    body.hidden = true;
    empty.hidden = false;
    empty.replaceChildren(
      el('p', {}, !state.jobs.length ? 'Add a job and a candidate first.' : 'Add a candidate to this job first.'),
      el('button', { class: 'primary-btn', type: 'button', onclick: () => goTo('jobs', { jobId: job?.id }) }, 'Go to Jobs'),
    );
    return;
  }
  empty.hidden = true;
  body.hidden = false;

  // What the plan will use, and what's missing.
  const missing: string[] = [];
  if (!job.skills.length) missing.push('the job’s skills checklist');
  if (!cand.resumeText) missing.push('the candidate’s resume');
  const inputs = $('prepInputs');
  inputs.replaceChildren(
    el('li', {}, el('b', {}, 'Job: '), S.jobLabel(job), ` · ${job.skills.length} skills`),
    el(
      'li',
      {},
      el('b', {}, 'Resume: '),
      cand.resumeText ? `${cand.resumeText.split(/\s+/).length} words` : 'not added',
      cand.profileUrl ? ' · ' : '',
      cand.profileUrl ? el('a', { class: 'profile-link', href: cand.profileUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open profile ↗') : null,
    ),
  );
  const note = $('prepMissing');
  note.hidden = !missing.length;
  note.replaceChildren(
    `Add ${missing.join(' and ')} first. `,
    el('button', { class: 'link-btn inline', type: 'button', onclick: () => goTo('jobs', { jobId: job.id }) }, 'Open the job'),
  );
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
  const { candidateId } = picker.get();
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
      await commit(S.updateCandidate(getState(), cand.id, { plan }));
      toast('Plan ready. You’ll also see it during the interview.');
    } catch (err) {
      toast(errorMessage(err), { error: true });
    }
  });
}
