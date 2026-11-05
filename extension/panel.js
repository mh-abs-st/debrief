// Side panel: job setup, skills checklist, live transcript, notes, and follow-up suggestions.
// The server gets only the job description and the answer you choose to send. Call audio goes straight to
// the speech service. Notes stay in this browser; the transcript is kept in this panel only.
import { startInterview, setCovered, setNotes, coverage, toMarkdown } from './notes.js';
import { startListening } from './capture.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { serverUrl: 'http://localhost:8789', appToken: '' };
const STORE_KEY = 'interview';

let state = null; // { skills: [{ name, why, covered, notes }] }
let listening = null; // { stop() } while the call is being transcribed

function setStatus(message, isError = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', isError);
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(DEFAULTS);
  $('server-url').value = saved.serverUrl;
  $('app-token').value = saved.appToken;
  return saved;
}

async function save() {
  if (state) await chrome.storage.local.set({ [STORE_KEY]: state });
}

async function api(path, body) {
  const { serverUrl, appToken } = await loadSettings();
  if (!appToken) throw new Error('Add the app token in Settings first.');
  const res = await fetch(`${serverUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

$('save-settings').addEventListener('click', async () => {
  await chrome.storage.local.set({
    serverUrl: $('server-url').value.trim().replace(/\/+$/, ''),
    appToken: $('app-token').value.trim(),
  });
  setStatus('Settings saved.');
});

// Builds the checklist with DOM calls and textContent only (no innerHTML).
function renderInterview() {
  const list = $('skills');
  list.replaceChildren();
  state.skills.forEach((skill, index) => {
    const item = document.createElement('li');

    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = skill.covered;
    box.addEventListener('change', async () => {
      state = setCovered(state, index, box.checked);
      await save();
      renderCoverage();
    });
    label.append(box, ` ${skill.name}`);
    item.append(label);

    if (skill.why) {
      const why = document.createElement('span');
      why.className = 'why';
      why.textContent = skill.why;
      item.append(why);
    }

    const notes = document.createElement('textarea');
    notes.rows = 2;
    notes.placeholder = 'Your notes';
    notes.value = skill.notes;
    notes.setAttribute('aria-label', `Notes for ${skill.name}`);
    let timer = null;
    notes.addEventListener('input', () => {
      state = setNotes(state, index, notes.value);
      clearTimeout(timer);
      timer = setTimeout(save, 400); // save while typing, without writing on every key
    });
    item.append(notes);

    list.append(item);
  });

  const select = $('followup-skill');
  select.replaceChildren(...state.skills.map((s, i) => new Option(s.name, String(i))));

  $('interview').hidden = false;
  $('live').hidden = false;
  $('followups').hidden = false;
  $('export').hidden = false;
  renderCoverage();
}

function renderCoverage() {
  const { covered, total } = coverage(state);
  $('coverage').textContent = `${covered} of ${total} skills covered`;
}

$('make-checklist').addEventListener('click', async () => {
  const jobDescription = $('job-description').value.trim();
  if (!jobDescription) return setStatus('Paste the job description first.', true);

  const button = $('make-checklist');
  button.disabled = true;
  setStatus('Making the checklist…');
  try {
    const data = await api('/api/skills', { jobDescription });
    if (!data.skills?.length) return setStatus('No skills found. Try a fuller job description.', true);
    state = startInterview(data.skills);
    await save();
    renderInterview();
    setStatus('Checklist ready.');
  } catch (err) {
    setStatus(err.message || 'We couldn’t reach the server. Check the address in Settings.', true);
  } finally {
    button.disabled = false;
  }
});

// ---- Live transcript ----

// The consent box must be ticked before listening can start.
$('consent').addEventListener('change', () => {
  $('start-listening').disabled = !$('consent').checked || Boolean(listening);
});

function renderTranscript(transcript) {
  const box = $('transcript');
  box.replaceChildren();
  for (const line of transcript.lines) {
    const p = document.createElement('p');
    p.textContent = line.text;
    box.append(p);
  }
  if (transcript.interim) {
    const p = document.createElement('p');
    p.className = 'interim';
    p.textContent = transcript.interim;
    box.append(p);
  }
  box.scrollTop = box.scrollHeight;
}

function setListeningUi(isListening) {
  $('start-listening').hidden = isListening;
  $('stop-listening').hidden = !isListening;
  $('start-listening').disabled = isListening || !$('consent').checked;
}

$('start-listening').addEventListener('click', async () => {
  if (!$('consent').checked) return setStatus('Confirm the candidate knows the call is being transcribed first.', true);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return setStatus('Open the call in this browser window first.', true);

  setStatus('Starting…');
  try {
    listening = await startListening({
      tabId: tab.id,
      getKey: () => api('/api/transcribe-token'),
      onTranscript: renderTranscript,
      onStatus: (text, isError) => {
        setStatus(text, isError);
        if (isError && listening) {
          listening = null;
          setListeningUi(false);
        }
      },
    });
    setListeningUi(true);
  } catch (err) {
    setStatus(err.message || 'We couldn’t start listening. Please try again.', true);
  }
});

$('stop-listening').addEventListener('click', () => {
  if (!listening) return;
  listening.stop();
  listening = null;
  setListeningUi(false);
});

// ---- Follow-up suggestions ----

$('suggest').addEventListener('click', async () => {
  const index = Number($('followup-skill').value);
  const answer = $('followup-answer').value.trim();
  if (!answer) return setStatus('Type or paste the candidate’s answer first.', true);

  const button = $('suggest');
  button.disabled = true;
  setStatus('Thinking of follow-ups…');
  try {
    const data = await api('/api/followups', {
      skill: state.skills[index].name,
      question: $('followup-question').value.trim(),
      answer,
    });
    renderSuggestions(data.questions || []);
    setStatus(data.questions?.length ? '' : 'No follow-ups to suggest for this answer.');
  } catch (err) {
    setStatus(err.message || 'We couldn’t reach the server. Check the address in Settings.', true);
  } finally {
    button.disabled = false;
  }
});

// Each suggestion is a plain line the interviewer can read aloud or copy. Nothing is sent back to the server.
function renderSuggestions(questions) {
  const list = $('suggestions');
  list.replaceChildren();
  for (const q of questions) {
    const item = document.createElement('li');
    item.textContent = q;
    list.append(item);
  }
}

$('copy-notes').addEventListener('click', async () => {
  if (!state) return;
  const text = toMarkdown(state, { date: new Date().toISOString().slice(0, 10) });
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Notes copied.');
  } catch {
    setStatus('Could not copy. Select the notes and copy them by hand.', true);
  }
});

async function restore() {
  await loadSettings();
  const saved = await chrome.storage.local.get({ [STORE_KEY]: null });
  if (saved[STORE_KEY]?.skills?.length) {
    state = saved[STORE_KEY];
    renderInterview();
  }
}

restore();
