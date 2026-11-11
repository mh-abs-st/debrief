// Jobs tab: every job you're hiring for, each with its required skills and its candidates.
import { $, el, toast, openSheet, confirmSheet, formatDate, fileToBase64, withBusy, closestTarget, errorMessage, type Nav } from './ui.ts';
import { getState, commit, subscribe } from './data.ts';
import { api } from './api.ts';
import { listeningCandidate, stoppedNote } from './interview-view.ts';
import * as S from './store.ts';

let filter = 'open';
let openJobId: string | null = null; // the job shown in detail, or null for the list
let editingJobId: string | null = null; // null = adding a new job
let editingCandidate: { jobId: string; id: string | null } = { jobId: '', id: null };
let draftSkills: S.Skill[] = []; // skills in the job sheet while editing

const input = (id: string) => $<HTMLInputElement>(id);
const textarea = (id: string) => $<HTMLTextAreaElement>(id);
const dialog = (id: string) => $<HTMLDialogElement>(id);

let nav: Nav;
export function initJobs(navigation: Nav): void {
  nav = navigation;

  $('jobsFilter').addEventListener('click', (e) => {
    const btn = closestTarget(e, '[data-v]');
    if (!btn) return;
    filter = btn.dataset.v || 'open';
    $('jobsFilter')
      .querySelectorAll('[data-v]')
      .forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    render();
  });
  $('jobsAdd').addEventListener('click', () => openJobSheet(null));
  $('jobBack').addEventListener('click', () => showJob(null));

  wireJobSheet();
  wireCandidateSheet();
  subscribe(render);
  render();
}

export function showJob(jobId: string | null): void {
  openJobId = jobId;
  render();
}

export function addJob(): void {
  openJobSheet(null);
}

export function addCandidateTo(jobId: string): void {
  openCandidateSheet(jobId, null);
}

// Edit sheet for a candidate, over whatever page is showing (e.g. Edit on their page).
export function editCandidate(candidateId: string): void {
  const c = S.getCandidate(getState(), candidateId);
  if (c) openCandidateSheet(c.jobId, c.id);
}

function render() {
  const state = getState();
  const job = S.getJob(state, openJobId);
  if (!job) openJobId = null;
  $('jobsListPane').hidden = Boolean(job);
  $('jobPane').hidden = !job;
  if (job) renderJob(job);
  else renderList(state);
}

// ---------- List ----------

function renderList(state: S.State) {
  const jobs = S.jobsByStatus(state, filter);
  const list = $('jobsList');
  if (!jobs.length) {
    list.replaceChildren(
      el('li', { class: 'empty' }, filter === 'closed' ? 'No closed jobs.' : 'No jobs yet. Add the first job you’re hiring for.'),
    );
    return;
  }
  list.replaceChildren(
    ...jobs.map((job) => {
      const cands = S.candidatesFor(state, job.id);
      const meta = [
        `${cands.length} candidate${cands.length === 1 ? '' : 's'}`,
        job.skills.length ? `${job.skills.length} skills` : 'No checklist yet',
        job.status === 'closed' ? 'Closed' : '',
      ].filter(Boolean);
      return el(
        'li',
        {},
        el(
          'button',
          { class: 'card job-card', type: 'button', onclick: () => showJob(job.id) },
          el('span', { class: 'card-title' }, job.title),
          job.company ? el('span', { class: 'card-sub' }, job.company) : null,
          el('span', { class: 'card-meta' }, meta.join(' · ')),
        ),
      );
    }),
  );
}

// ---------- One job ----------

function renderJob(job: S.Job) {
  const state = getState();
  $('jobTitle').textContent = job.title;
  $('jobCompany').textContent = job.company;
  $('jobCompany').hidden = !job.company;

  const actions = $('jobActions');
  actions.replaceChildren(
    el('button', { class: 'soft-btn', type: 'button', onclick: () => openJobSheet(job.id) }, 'Edit job'),
    el(
      'button',
      {
        class: 'soft-btn',
        type: 'button',
        onclick: async () => {
          if (!(await commit(S.updateJob(getState(), job.id, { status: job.status === 'open' ? 'closed' : 'open' })))) return;
          toast(job.status === 'open' ? 'Job closed.' : 'Job reopened.');
        },
      },
      job.status === 'open' ? 'Close job' : 'Reopen job',
    ),
    el(
      'button',
      {
        class: 'link-btn danger',
        type: 'button',
        onclick: async () => {
          const count = S.candidatesFor(getState(), job.id).length;
          const listened = listeningCandidate();
          const listening = S.getCandidate(getState(), listened)?.jobId === job.id;
          const ok = await confirmSheet({
            title: 'Delete this job?',
            body:
              (count
                ? `This also deletes its ${count} candidate${count === 1 ? '' : 's'}, their resumes, plans and interview notes. This can’t be undone.`
                : 'This can’t be undone.') + (listening ? ' Debrief stops listening to the call.' : ''),
          });
          if (!ok) return;
          if (!(await commit(S.removeJob(getState(), job.id)))) return;
          toast('Job deleted.' + stoppedNote(listened));
        },
      },
      'Delete',
    ),
  );

  // Skills
  const skills = $('jobSkills');
  skills.replaceChildren(
    ...(job.skills.length
      ? job.skills.map((s) => el('li', {}, el('b', {}, s.name), s.why ? el('span', { class: 'why' }, s.why) : null))
      : [el('li', { class: 'empty' }, 'No checklist yet. Edit the job to make one from the job description.')]),
  );

  // Candidates
  const cands = S.candidatesFor(state, job.id);
  $('candCount').textContent = cands.length ? `(${cands.length})` : '';
  const list = $('candList');
  list.replaceChildren(
    ...(cands.length ? cands.map((c) => candidateCard(job, c)) : [el('li', { class: 'empty' }, 'No candidates yet.')]),
  );
  $('candAdd').onclick = () => openCandidateSheet(job.id, null);
}

function candidateCard(job: S.Job, c: S.Candidate) {
  const stage = el(
    'select',
    {
      class: 'stage-select',
      'aria-label': `Stage for ${c.name}`,
      onchange: async (e: Event) => commit(S.updateCandidate(getState(), c.id, { stage: (e.target as HTMLSelectElement).value })),
    },
    ...S.STAGES.map((s) => new Option(S.STAGE_LABELS[s], s)),
  );
  stage.value = c.stage;

  const facts = [
    c.interviewAt ? `Interview ${formatDate(c.interviewAt)}` : '',
    c.resumeText ? 'Resume added' : 'No resume yet',
    c.plan ? 'Plan ready' : '',
  ].filter(Boolean);

  return el(
    'li',
    { class: 'card cand-card' },
    el(
      'div',
      { class: 'cand-head' },
      el('span', { class: 'card-title' }, c.name),
      stage,
    ),
    el('span', { class: 'card-meta' }, facts.join(' · ')),
    c.profileUrl
      ? el('a', { class: 'profile-link', href: c.profileUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open profile ↗')
      : null,
    el(
      'div',
      { class: 'row' },
      el('button', { class: 'soft-btn', type: 'button', onclick: () => nav.candidate(c.id) }, 'Open'),
      el('button', { class: 'link-btn', type: 'button', onclick: () => openCandidateSheet(job.id, c.id) }, 'Edit'),
      el(
        'button',
        {
          class: 'link-btn danger',
          type: 'button',
          onclick: async () => {
            const listened = listeningCandidate();
            const ok = await confirmSheet({
              title: `Delete ${c.name}?`,
              body:
                'This deletes their profile link, resume, plan and interview notes from this computer. This can’t be undone.' +
                (listened === c.id ? ' Debrief stops listening to the call.' : ''),
            });
            if (!ok) return;
            if (!(await commit(S.removeCandidate(getState(), c.id)))) return;
            toast('Candidate deleted.' + stoppedNote(listened));
          },
        },
        'Delete',
      ),
    ),
  );
}

// ---------- Job sheet (add / edit) ----------

function openJobSheet(jobId: string | null) {
  editingJobId = jobId;
  const job = jobId ? S.getJob(getState(), jobId) : null;
  $('jobSheetTitle').textContent = job ? 'Edit job' : 'Add a job';
  input('jobFormTitle').value = job?.title || '';
  input('jobFormCompany').value = job?.company || '';
  textarea('jobFormDescription').value = job?.description || '';
  draftSkills = (job?.skills || []).map((s) => ({ ...s }));
  renderDraftSkills();
  openSheet('jobSheet');
  input('jobFormTitle').focus();
}

function renderDraftSkills() {
  const list = $('jobFormSkills');
  list.replaceChildren(
    ...draftSkills.map((s, i) =>
      el(
        'li',
        {},
        el('span', {}, el('b', {}, s.name), s.why ? el('span', { class: 'why' }, s.why) : null),
        el(
          'button',
          {
            class: 'icon-btn',
            type: 'button',
            'aria-label': `Remove ${s.name}`,
            title: 'Remove',
            onclick: () => {
              draftSkills.splice(i, 1);
              renderDraftSkills();
            },
          },
          '×',
        ),
      ),
    ),
  );
  $('jobFormSkillsEmpty').hidden = draftSkills.length > 0;
}

function wireJobSheet() {
  $('jobFormMakeSkills').addEventListener('click', async (e) => {
    const description = textarea('jobFormDescription').value.trim();
    if (!description) return toast('Paste the job description first.', { error: true });
    await withBusy(e.currentTarget as HTMLButtonElement, 'Reading the job…', async () => {
      try {
        const { skills } = await api('/api/skills', { jobDescription: description });
        if (!skills?.length) return toast('No skills found. Try a fuller job description, or add skills yourself.', { error: true });
        draftSkills = skills;
        renderDraftSkills();
        toast('Checklist ready. Remove or add skills as you like.');
      } catch (err) {
        toast(errorMessage(err), { error: true });
      }
    });
  });

  const addSkill = () => {
    const field = input('jobFormNewSkill');
    const name = field.value.trim();
    if (!name) return;
    if (draftSkills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast('That skill is already on the list.');
    draftSkills.push({ name, why: '' });
    field.value = '';
    renderDraftSkills();
  };
  $('jobFormAddSkill').addEventListener('click', addSkill);
  $('jobFormNewSkill').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  });

  $('jobFormSave').addEventListener('click', async () => {
    const fields = {
      title: input('jobFormTitle').value,
      company: input('jobFormCompany').value,
      description: textarea('jobFormDescription').value,
      skills: draftSkills,
    };
    if (!fields.title.trim()) return toast('Add the job title.', { error: true });
    // If the save fails, the sheet stays open so you can try again.
    if (editingJobId) {
      if (!(await commit(S.updateJob(getState(), editingJobId, fields)))) return;
      toast('Job saved.');
    } else {
      const { state, job } = S.addJob(getState(), fields);
      openJobId = job.id;
      if (!(await commit(state))) {
        editingJobId = job.id; // it's in memory now: trying again saves it rather than adding a second one
        return;
      }
      toast('Job added. Now add your candidates.');
    }
    dialog('jobSheet').close();
  });
}

// ---------- Candidate sheet (add / edit) ----------

function openCandidateSheet(jobId: string, candidateId: string | null) {
  editingCandidate = { jobId, id: candidateId };
  const c = candidateId ? S.getCandidate(getState(), candidateId) : null;
  const job = S.getJob(getState(), jobId);
  $('candSheetTitle').textContent = c ? `Edit ${c.name}` : 'Add a candidate';
  $('candSheetJob').textContent = S.jobLabel(job);
  input('candFormName').value = c?.name || '';
  input('candFormEmail').value = c?.email || '';
  input('candFormProfile').value = c?.profileUrl || '';
  input('candFormInterviewAt').value = c?.interviewAt || '';
  textarea('candFormResume').value = c?.resumeText || '';
  input('candFormFile').value = '';
  openSheet('candidateSheet');
  input('candFormName').focus();
}

function wireCandidateSheet() {
  input('candFormFile').addEventListener('change', async (e) => {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return toast('Choose a PDF file, or paste the resume text.', { error: true });
    if (file.size > 8 * 1024 * 1024) return toast('That PDF is over 8 MB. Try a smaller file, or paste the text.', { error: true });
    const label = $('candFormFileLabel');
    label.classList.add('busy');
    toast('Reading the resume…');
    try {
      const pdfBase64 = await fileToBase64(file);
      const { text } = await api('/api/resume/parse', { pdfBase64 });
      textarea('candFormResume').value = text;
      toast('Resume read. Check the text, then save.');
    } catch (err) {
      toast(errorMessage(err), { error: true });
    } finally {
      label.classList.remove('busy');
      fileInput.value = '';
    }
  });

  $('candFormSave').addEventListener('click', async () => {
    const fields: S.CandidateFields & { name: string; profileUrl: string; interviewAt: string } = {
      name: input('candFormName').value,
      email: input('candFormEmail').value,
      profileUrl: input('candFormProfile').value,
      interviewAt: input('candFormInterviewAt').value,
      resumeText: textarea('candFormResume').value,
    };
    if (!fields.name.trim()) return toast('Add the candidate’s name.', { error: true });
    if (fields.profileUrl.trim() && !S.cleanUrl(fields.profileUrl)) return toast('That profile link doesn’t look right. Use a web address.', { error: true });
    if (fields.interviewAt && !editingCandidate.id) fields.stage = 'scheduled';
    try {
      if (editingCandidate.id) {
        if (!(await commit(S.updateCandidate(getState(), editingCandidate.id, fields)))) return; // sheet stays open
        toast('Candidate saved.');
      } else {
        const { state, candidate } = S.addCandidate(getState(), editingCandidate.jobId, fields);
        if (!(await commit(state))) {
          editingCandidate.id = candidate.id; // it's in memory now: trying again saves it rather than adding a second one
          return;
        }
        toast('Candidate added.');
      }
      dialog('candidateSheet').close();
    } catch (err) {
      toast(errorMessage(err), { error: true });
    }
  });
}
