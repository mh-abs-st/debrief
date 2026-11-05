// Live tab: the interview itself. Checklist and notes for the chosen candidate, the live transcript,
// follow-up suggestions and the questions you planned in Prepare.
import { $, el, toast, confirmSheet, fillSelect, withBusy, formatDate, errorMessage, type GoTo } from './ui.ts';
import { getState, getSettings, commit, commitSoon, subscribe } from './data.ts';
import { api } from './api.ts';
import { createPicker, type Picker } from './picker.ts';
import { startListening, type Listening } from './capture.ts';
import { emptyTranscript, recentText, transcriptText } from './transcript.ts';
import * as S from './store.ts';

let picker: Picker;
let goTo: GoTo = () => {};
let listening: Listening | null = null; // set while the call is being transcribed
let transcript = emptyTranscript(); // kept in this panel only, never saved

const input = (id: string) => $<HTMLInputElement>(id);
const textarea = (id: string) => $<HTMLTextAreaElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);

export function initLive({ onGo }: { onGo: GoTo }): void {
  goTo = onGo;
  picker = createPicker($('livePicker'), {
    onChange: () => {
      stopListening(); // never keep listening for a candidate you switched away from
      render();
    },
  });

  $('liveStart').addEventListener('click', async () => {
    const { candidateId } = picker.get();
    const { state } = S.startInterview(getState(), candidateId);
    transcript = emptyTranscript();
    renderTranscript();
    await commit(state);
    toast('Interview started. Tick skills as you cover them.');
  });
  $('liveConsent').addEventListener('change', updateListenButtons);
  $('liveListen').addEventListener('click', start);
  $('liveStop').addEventListener('click', () => {
    stopListening();
    toast('Stopped listening.');
  });
  $('liveUseTranscript').addEventListener('click', () => {
    const text = recentText(transcript);
    if (!text) return toast('Nothing in the transcript yet.', { error: true });
    textarea('liveAnswer').value = text;
  });
  $('liveSuggest').addEventListener('click', (e) => suggest(e.currentTarget as HTMLButtonElement));
  textarea('liveGeneral').addEventListener('input', (e) => {
    const iv = currentInterview();
    if (iv) commitSoon(S.setGeneralNotes(getState(), iv.id, (e.target as HTMLTextAreaElement).value));
  });
  $('liveCopy').addEventListener('click', () => {
    const iv = currentInterview();
    if (iv) copy(S.interviewMarkdown(getState(), iv.id), 'Notes copied.');
  });
  $('liveCopyTranscript').addEventListener('click', () => {
    const text = transcriptText(transcript);
    if (!text) return toast('Nothing in the transcript yet.', { error: true });
    copy(text, 'Transcript copied.');
  });
  $('liveEnd').addEventListener('click', endInterview);

  subscribe(() => {
    picker.refresh();
    render();
  });
  picker.refresh();
  render();
  renderTranscript();
}

export function selectForLive(jobId: string | null | undefined, candidateId: string | null | undefined): void {
  stopListening();
  picker.set(jobId, candidateId);
  render();
}

export const isListening = (): boolean => Boolean(listening);

function currentInterview(): S.Interview | null {
  const { candidateId } = picker.get();
  return candidateId ? S.openInterview(getState(), candidateId) : null;
}

function render() {
  const state = getState();
  const { jobId, candidateId } = picker.get();
  const job = S.getJob(state, jobId);
  const cand = S.getCandidate(state, candidateId);

  if (!job || !cand) {
    $('liveBody').hidden = true;
    $('liveEmpty').hidden = false;
    $('liveEmpty').replaceChildren(
      el('p', {}, !state.jobs.length ? 'Add a job and a candidate in Jobs, then come back here for the interview.' : 'Add a candidate to this job first.'),
      el('button', { class: 'primary-btn', type: 'button', onclick: () => goTo('jobs', { jobId: job?.id, addCandidate: Boolean(job) }) }, job ? 'Add a candidate' : 'Add a job'),
      el('p', { class: 'help' }, 'Want to see how it works first? Try the Demo tab.'),
    );
    return;
  }
  $('liveEmpty').hidden = true;
  $('liveBody').hidden = false;

  const iv = S.openInterview(state, cand.id);
  $('liveName').textContent = cand.name;
  $('liveMeta').textContent = [S.STAGE_LABELS[cand.stage], cand.interviewAt ? formatDate(cand.interviewAt) : ''].filter(Boolean).join(' · ');
  const profile = $<HTMLAnchorElement>('liveProfile');
  profile.hidden = !cand.profileUrl;
  if (cand.profileUrl) profile.href = cand.profileUrl;

  $('liveStartBox').hidden = Boolean(iv);
  $('liveRun').hidden = !iv;
  $('liveNoSkills').hidden = Boolean(job.skills.length);

  if (iv) {
    renderChecklist(iv);
    const skillSelect = $<HTMLSelectElement>('liveSkill');
    fillSelect(skillSelect, iv.skills.map((s, i) => ({ value: String(i), label: s.name })), skillSelect.value);
    $('liveFollowups').hidden = !iv.skills.length;
    if (document.activeElement !== $('liveGeneral')) textarea('liveGeneral').value = iv.generalNotes;
  }
  renderPlan(cand);
  renderPast(cand);
  updateListenButtons();
}

function renderChecklist(iv: S.Interview) {
  const { covered, total } = S.coverage(iv);
  $('liveCoverage').textContent = total ? `${covered} of ${total} covered` : '';
  $('liveCoverBar').style.width = total ? `${Math.round((covered / total) * 100)}%` : '0%';

  // Don't rebuild while you're typing in one of the notes boxes (you'd lose your place).
  if ($('liveSkills').contains(document.activeElement) && document.activeElement?.tagName === 'TEXTAREA') return;

  $('liveSkills').replaceChildren(
    ...iv.skills.map((s, i) => {
      const box = el('input', {
        type: 'checkbox',
        checked: s.covered,
        onchange: async (e: Event) => commit(S.setSkillCovered(getState(), iv.id, i, (e.target as HTMLInputElement).checked)),
      });
      const notes = el('textarea', {
        rows: 2,
        placeholder: 'Your notes',
        'aria-label': `Notes for ${s.name}`,
        value: s.notes,
        oninput: (e: Event) => commitSoon(S.setSkillNotes(getState(), iv.id, i, (e.target as HTMLTextAreaElement).value)),
      });
      return el(
        'li',
        { class: s.covered ? 'covered' : '' },
        el('label', { class: 'check' }, box, el('span', {}, s.name)),
        s.why ? el('span', { class: 'why' }, s.why) : null,
        notes,
      );
    }),
  );
}

// The questions planned in Prepare, collapsed by default so they don't push the checklist down.
function renderPlan(cand: S.Candidate) {
  const box = $('livePlan');
  const plan = cand.plan;
  box.hidden = !plan;
  if (!plan) return;
  const items: HTMLLIElement[] = [];
  if (plan.opening) items.push(el('li', {}, el('span', { class: 'tag' }, 'Start'), plan.opening));
  for (const s of plan.skills) for (const q of s.questions) items.push(el('li', {}, el('span', { class: 'tag' }, s.name), q));
  for (const v of plan.verify || []) items.push(el('li', {}, el('span', { class: 'tag' }, 'Check'), v.question));
  $('livePlanList').replaceChildren(...items);
}

function renderPast(cand: S.Candidate) {
  const past = S.interviewsFor(getState(), cand.id).filter((i) => i.endedAt);
  $('livePast').hidden = !past.length;
  $('livePastList').replaceChildren(
    ...past.map((iv) => {
      const { covered, total } = S.coverage(iv);
      return el(
        'li',
        {},
        el('span', {}, `${formatDate(new Date(iv.startedAt).toISOString())} · ${covered} of ${total} covered`),
        el('button', { class: 'link-btn', type: 'button', onclick: () => copy(S.interviewMarkdown(getState(), iv.id), 'Notes copied.') }, 'Copy notes'),
      );
    }),
  );
}

// ---------- Listening ----------

function updateListenButtons() {
  const on = Boolean(listening);
  button('liveListen').hidden = on;
  button('liveStop').hidden = !on;
  button('liveListen').disabled = !input('liveConsent').checked;
  input('liveConsent').disabled = on;
  $('liveDot').classList.toggle('on', on);
  $('liveState').textContent = on ? 'Listening' : 'Not listening';
}

function renderTranscript() {
  const box = $('liveTranscript');
  const nodes = transcript.lines.map((l) => el('p', {}, l.text));
  if (transcript.interim) nodes.push(el('p', { class: 'interim' }, transcript.interim));
  if (!nodes.length) nodes.push(el('p', { class: 'placeholder' }, 'The transcript shows up here while you listen.'));
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.replaceChildren(...nodes);
  if (atBottom) box.scrollTop = box.scrollHeight;
}

async function start() {
  if (!input('liveConsent').checked) return toast('Tick the box first: the candidate must know the call is transcribed.', { error: true });
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https:/.test(tab.url || '')) return toast('Open the call in a browser tab first (Google Meet, Zoom or Teams on the web).', { error: true });
  toast('Starting…');
  try {
    listening = await startListening({
      tabId: tab.id,
      language: getSettings().language,
      getKey: () => api('/api/transcribe-token'),
      onTranscript: (t) => {
        transcript = t;
        renderTranscript();
      },
      onStatus: (text, isError) => {
        if (text !== 'Stopped.') toast(text === 'Listening' ? 'Listening to the call.' : text, { error: isError });
        if (isError) {
          listening = null;
          updateListenButtons();
        }
      },
    });
  } catch (err) {
    listening = null;
    toast(errorMessage(err, 'We couldn’t start listening. Please try again.'), { error: true });
  }
  updateListenButtons();
}

function stopListening() {
  if (!listening) return;
  listening.stop();
  listening = null;
  updateListenButtons();
}

// ---------- Follow-ups ----------

async function suggest(btn: HTMLButtonElement) {
  const iv = currentInterview();
  if (!iv) return;
  const skill = iv.skills[Number($<HTMLSelectElement>('liveSkill').value)];
  const answer = textarea('liveAnswer').value.trim();
  if (!skill) return;
  if (!answer) return toast('Add the candidate’s answer first, or use the transcript.', { error: true });
  await withBusy(btn, 'Thinking…', async () => {
    try {
      const { questions } = await api('/api/followups', { skill: skill.name, question: input('liveQuestion').value.trim(), answer });
      $('liveSuggestions').replaceChildren(
        ...(questions.length ? questions.map((q) => el('li', {}, q)) : [el('li', { class: 'empty' }, 'No follow-ups to suggest for this answer.')]),
      );
    } catch (err) {
      toast(errorMessage(err), { error: true });
    }
  });
}

// ---------- End ----------

async function endInterview() {
  const iv = currentInterview();
  if (!iv) return;
  const { covered, total } = S.coverage(iv);
  const ok = await confirmSheet({
    title: 'End the interview?',
    body: `${covered} of ${total} skills covered. Your notes are kept and you can copy them any time. The transcript isn’t saved.`,
    yes: 'End interview',
    no: 'Keep going',
    danger: false,
  });
  if (!ok) return;
  stopListening();
  await commit(S.endInterview(getState(), iv.id));
  transcript = emptyTranscript();
  renderTranscript();
  input('liveConsent').checked = false;
  $('liveSuggestions').replaceChildren();
  textarea('liveAnswer').value = '';
  input('liveQuestion').value = '';
  updateListenButtons();
  toast('Interview ended. Notes saved on this computer.');
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Couldn’t copy. Please try again.', { error: true });
  }
}
