// Jobs tab: every job you're hiring for, each with its required skills and its candidates.
import { $, el, toast, openSheet, confirmSheet, formatDate, fileToBase64, withBusy } from './ui.js';
import { getState, commit, subscribe } from './data.js';
import { api } from './api.js';
import * as S from './store.js';

let filter = 'open';
let openJobId = null; // the job shown in detail, or null for the list
let editingJobId = null; // null = adding a new job
let editingCandidate = { jobId: null, id: null };
let draftSkills = []; // skills in the job sheet while editing

// Other tabs ask to show something here (e.g. "Add a job" from an empty Live tab).
let goTo = () => {};
export function initJobs({ onGo }) {
  goTo = onGo;

  $('jobsFilter').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-v]');
    if (!btn) return;
    filter = btn.dataset.v;
    $('jobsFilter').querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    render();
  });
  $('jobsAdd').addEventListener('click', () => openJobSheet(null));
  $('jobBack').addEventListener('click', () => showJob(null));

  wireJobSheet();
  wireCandidateSheet();
  subscribe(render);
  render();
}

export function showJob(jobId) {
  openJobId = jobId;
  render();
}

export function addJob() {
  openJobSheet(null);
}

export function addCandidateTo(jobId) {
  openCandidateSheet(jobId, null);
}

function render() {
  const state = getState();
  if (openJobId && !S.getJob(state, openJobId)) openJobId = null;
  $('jobsListPane').hidden = Boolean(openJobId);
  $('jobPane').hidden = !openJobId;
  if (openJobId) renderJob(S.getJob(state, openJobId));
  else renderList(state);
}

// ---------- List ----------

function renderList(state) {
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

function renderJob(job) {
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
          await commit(S.updateJob(getState(), job.id, { status: job.status === 'open' ? 'closed' : 'open' }));
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
          const ok = await confirmSheet({
            title: 'Delete this job?',
            body: count
              ? `This also deletes its ${count} candidate${count === 1 ? '' : 's'}, their resumes, plans and interview notes. This can’t be undone.`
              : 'This can’t be undone.',
          });
          if (!ok) return;
          await commit(S.removeJob(getState(), job.id));
          toast('Job deleted.');
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

function candidateCard(job, c) {
  const stage = el(
    'select',
    {
      class: 'stage-select',
      'aria-label': `Stage for ${c.name}`,
      onchange: async (e) => commit(S.updateCandidate(getState(), c.id, { stage: e.target.value })),
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
      el('button', { class: 'soft-btn', type: 'button', onclick: () => goTo('prepare', { jobId: job.id, candidateId: c.id }) }, 'Prepare'),
      el('button', { class: 'soft-btn', type: 'button', onclick: () => goTo('live', { jobId: job.id, candidateId: c.id }) }, 'Interview'),
      el('button', { class: 'link-btn', type: 'button', onclick: () => openCandidateSheet(job.id, c.id) }, 'Edit'),
      el(
        'button',
        {
          class: 'link-btn danger',
          type: 'button',
          onclick: async () => {
            const ok = await confirmSheet({
              title: `Delete ${c.name}?`,
              body: 'This deletes their profile link, resume, plan and interview notes from this computer. This can’t be undone.',
            });
            if (!ok) return;
            await commit(S.removeCandidate(getState(), c.id));
            toast('Candidate deleted.');
          },
        },
        'Delete',
      ),
    ),
  );
}

// ---------- Job sheet (add / edit) ----------

function openJobSheet(jobId) {
  editingJobId = jobId;
  const job = jobId ? S.getJob(getState(), jobId) : null;
  $('jobSheetTitle').textContent = job ? 'Edit job' : 'Add a job';
  $('jobFormTitle').value = job?.title || '';
  $('jobFormCompany').value = job?.company || '';
  $('jobFormDescription').value = job?.description || '';
  draftSkills = (job?.skills || []).map((s) => ({ ...s }));
  renderDraftSkills();
  openSheet('jobSheet');
  $('jobFormTitle').focus();
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
    const description = $('jobFormDescription').value.trim();
    if (!description) return toast('Paste the job description first.', { error: true });
    await withBusy(e.currentTarget, 'Reading the job…', async () => {
      try {
        const { skills } = await api('/api/skills', { jobDescription: description });
        if (!skills?.length) return toast('No skills found. Try a fuller job description, or add skills yourself.', { error: true });
        draftSkills = skills;
        renderDraftSkills();
        toast('Checklist ready. Remove or add skills as you like.');
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
  });

  const addSkill = () => {
    const input = $('jobFormNewSkill');
    const name = input.value.trim();
    if (!name) return;
    if (draftSkills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast('That skill is already on the list.');
    draftSkills.push({ name, why: '' });
    input.value = '';
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
      title: $('jobFormTitle').value,
      company: $('jobFormCompany').value,
      description: $('jobFormDescription').value,
      skills: draftSkills,
    };
    if (!fields.title.trim()) return toast('Add the job title.', { error: true });
    if (editingJobId) {
      await commit(S.updateJob(getState(), editingJobId, fields));
      toast('Job saved.');
    } else {
      const { state, job } = S.addJob(getState(), fields);
      openJobId = job.id;
      await commit(state);
      toast('Job added. Now add your candidates.');
    }
    $('jobSheet').close();
  });
}

// ---------- Candidate sheet (add / edit) ----------

function openCandidateSheet(jobId, candidateId) {
  editingCandidate = { jobId, id: candidateId };
  const c = candidateId ? S.getCandidate(getState(), candidateId) : null;
  const job = S.getJob(getState(), jobId);
  $('candSheetTitle').textContent = c ? `Edit ${c.name}` : 'Add a candidate';
  $('candSheetJob').textContent = S.jobLabel(job);
  $('candFormName').value = c?.name || '';
  $('candFormEmail').value = c?.email || '';
  $('candFormProfile').value = c?.profileUrl || '';
  $('candFormInterviewAt').value = c?.interviewAt || '';
  $('candFormResume').value = c?.resumeText || '';
  $('candFormFile').value = '';
  openSheet('candidateSheet');
  $('candFormName').focus();
}

function wireCandidateSheet() {
  $('candFormFile').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return toast('Choose a PDF file, or paste the resume text.', { error: true });
    if (file.size > 8 * 1024 * 1024) return toast('That PDF is over 8 MB. Try a smaller file, or paste the text.', { error: true });
    const label = $('candFormFileLabel');
    label.classList.add('busy');
    toast('Reading the resume…');
    try {
      const pdfBase64 = await fileToBase64(file);
      const { text } = await api('/api/resume/parse', { pdfBase64 });
      $('candFormResume').value = text;
      toast('Resume read. Check the text, then save.');
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      label.classList.remove('busy');
      e.target.value = '';
    }
  });

  $('candFormSave').addEventListener('click', async () => {
    const fields = {
      name: $('candFormName').value,
      email: $('candFormEmail').value,
      profileUrl: $('candFormProfile').value,
      interviewAt: $('candFormInterviewAt').value,
      resumeText: $('candFormResume').value,
    };
    if (!fields.name.trim()) return toast('Add the candidate’s name.', { error: true });
    if (fields.profileUrl.trim() && !S.cleanUrl(fields.profileUrl)) return toast('That profile link doesn’t look right. Use a web address.', { error: true });
    if (fields.interviewAt && !editingCandidate.id) fields.stage = 'scheduled';
    try {
      if (editingCandidate.id) {
        await commit(S.updateCandidate(getState(), editingCandidate.id, fields));
        toast('Candidate saved.');
      } else {
        const { state } = S.addCandidate(getState(), editingCandidate.jobId, fields);
        await commit(state);
        toast('Candidate added.');
      }
      $('candidateSheet').close();
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}
