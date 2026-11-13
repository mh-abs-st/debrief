// Interview section of a candidate's page: the interview itself. Checklist and notes, the live transcript,
// follow-up suggestions and the questions from the plan.
import { $, el, toast, confirmSheet, fillSelect, withBusy, errorMessage } from './ui.ts';
import { getState, getSettings, commit, commitSoon, savePendingNow, subscribe } from './data.ts';
import { api } from './api.ts';
import { startListening, type Listening } from './capture.ts';
import { emptyTranscript, recentText, transcriptText } from './transcript.ts';
import { leftCallSite, LISTENING_BADGE } from './call-tab.ts';
import * as S from './store.ts';

let candidateId = ''; // the candidate this section shows
let listeningFor = ''; // the candidate whose call is being transcribed
let listening: Listening | null = null; // set while the call is being transcribed
let transcript = emptyTranscript(); // kept in this panel only, never saved
let onEnd: (candidateId: string) => void = () => {};
let callTab: { id: number; url: string } | null = null; // the tab being listened to

const input = (id: string) => $<HTMLInputElement>(id);
const textarea = (id: string) => $<HTMLTextAreaElement>(id);
const button = (id: string) => $<HTMLButtonElement>(id);

// onEnd runs just before an ended interview is saved, so the page can keep this candidate and show Notes
// (saving redraws everything, and the Interview tab would otherwise move on to the next candidate).
// openCandidate(id) shows that candidate's Interview part: the listening band uses it from any page.
export function initInterview(options: { onEnd: (candidateId: string) => void; openCandidate: (candidateId: string) => void }): void {
  onEnd = options.onEnd;
  $('liveBandOpen').addEventListener('click', () => {
    if (listeningFor) options.openCandidate(listeningFor);
  });
  $('liveBandStop').addEventListener('click', () => {
    stopListening();
    toast('Stopped listening.');
  });
  // Stop when the call tab closes or goes to another site, and say so.
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (!listening || tabId !== callTab?.id) return;
    stopListening();
    toast('Stopped listening: the call tab was closed.', { error: true });
  });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    const call = callTab;
    if (!listening || !call || tabId !== call.id || !change.url || !leftCallSite(call.url, change.url)) return;
    stopListening();
    toast('Stopped listening: the call tab went to another site.', { error: true });
  });
  // A badge left from a panel that closed while listening (closing the panel ends the audio).
  showBadge(false);
  window.addEventListener('pagehide', () => showBadge(false));
  $('liveStart').addEventListener('click', async () => {
    const { state } = S.startInterview(getState(), candidateId);
    transcript = emptyTranscript();
    renderTranscript();
    if (!(await commit(state))) return; // the save failure is on screen; don't start transcribing
    // Listening starts with the interview; it can be stopped and restarted from the listening card.
    await start();
  });
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
  textarea('liveGeneral').addEventListener('change', () => void savePendingNow()); // left the field: save now
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
  // Deleting a candidate (or their job, or everything) from any tab: stop transcribing their call and drop
  // what was heard. This page may not be on screen, so it can't wait for its next render.
  subscribe((state) => {
    if (listeningFor && !exists(state, listeningFor)) stopListening();
    if (candidateId && !exists(state, candidateId) && (transcript.lines.length || transcript.interim)) {
      transcript = emptyTranscript();
      renderTranscript();
    }
  });
  renderTranscript();
}

const exists = (state: S.State, id: string): boolean => {
  const cand = S.getCandidate(state, id);
  return Boolean(cand && S.getJob(state, cand.jobId));
};

// For the toast after a delete: what to add when that delete stopped listening.
// wasListening is listeningCandidate() from just before the delete.
export const stoppedNote = (wasListening: string): string =>
  wasListening && !listening ? ' Stopped listening and cleared the transcript.' : '';

// Shows the interview for this candidate. candidate-view calls it on open and after every change.
// Opening a different candidate stops listening: never keep transcribing a call you moved away from.
export function renderInterviewSection(id: string): void {
  if (id !== candidateId) {
    if (listeningFor && listeningFor !== id) {
      stopListening();
      transcript = emptyTranscript();
      renderTranscript();
    }
    candidateId = id;
    $('liveSuggestions').replaceChildren();
    textarea('liveAnswer').value = '';
    input('liveQuestion').value = '';
  }
  render();
}

export const isListening = (): boolean => Boolean(listening);
// The candidate whose call is being transcribed, or '' when not listening.
export const listeningCandidate = (): string => (listening ? listeningFor : '');

function currentInterview(): S.Interview | null {
  return candidateId ? S.openInterview(getState(), candidateId) : null;
}

function render() {
  const state = getState();
  const cand = S.getCandidate(state, candidateId);
  const job = cand && S.getJob(state, cand.jobId);
  if (!cand || !job) return;

  const iv = S.openInterview(state, cand.id);
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
        onchange: () => void savePendingNow(), // left the field: save now
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

// ---------- Listening ----------

// Every change to listening ends here: the buttons, the band on every page and the toolbar badge.
function updateListenButtons() {
  const on = Boolean(listening);
  if (!on) callTab = null;
  button('liveListen').hidden = on;
  button('liveStop').hidden = !on;
  $('liveDot').classList.toggle('on', on);
  $('liveState').textContent = on ? 'Listening' : 'Not listening';
  const name = on ? S.getCandidate(getState(), listeningFor)?.name : '';
  $('liveBandName').textContent = name ? `: ${name}` : '';
  $('liveBand').hidden = !on;
  showBadge(on);
}

// The red "LIVE" on the Debrief icon, so it shows even with the panel scrolled or another tab in front.
function showBadge(on: boolean) {
  chrome.action.setBadgeText({ text: on ? LISTENING_BADGE : '' }).catch(() => {});
  if (on) chrome.action.setBadgeBackgroundColor({ color: '#d6334a' }).catch(() => {});
  chrome.action.setTitle({ title: on ? 'Debrief: listening to the call' : 'Open Debrief' }).catch(() => {});
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
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !/^https:/.test(tab.url || '')) return toast('Open the call in a browser tab first (Google Meet, Zoom or Teams on the web).', { error: true });
  toast('Starting…');
  try {
    listeningFor = candidateId;
    listening = await startListening({
      tabId: tab.id,
      language: getSettings().language,
      transcript, // keep what was said before a stop
      getKey: () => api('/api/transcribe-token'),
      onTranscript: (t) => {
        transcript = t;
        renderTranscript();
      },
      onStatus: (text, isError) => {
        if (text !== 'Stopped.') toast(text === 'Listening' ? 'Listening to the call.' : text, { error: isError });
        if (isError) {
          listening = null;
          listeningFor = '';
          updateListenButtons();
        }
      },
    });
    callTab = { id: tab.id, url: tab.url || '' };
    // Deleted while listening was starting up.
    if (!exists(getState(), listeningFor)) {
      stopListening();
      transcript = emptyTranscript();
      renderTranscript();
      toast('Stopped listening: that candidate was deleted.');
    }
  } catch (err) {
    listening = null;
    listeningFor = '';
    toast(errorMessage(err, 'We couldn’t start listening. Please try again.'), { error: true });
  }
  updateListenButtons();
}

function stopListening() {
  if (!listening) return;
  listening.stop();
  listening = null;
  listeningFor = '';
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
  onEnd(candidateId);
  const saved = await commit(S.endInterview(getState(), iv.id));
  transcript = emptyTranscript();
  renderTranscript();
  $('liveSuggestions').replaceChildren();
  textarea('liveAnswer').value = '';
  input('liveQuestion').value = '';
  updateListenButtons();
  if (saved) toast('Interview ended. Your notes are under Notes.');
}

export async function copy(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Couldn’t copy. Please try again.', { error: true });
  }
}
