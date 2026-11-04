// Side panel: job setup (paste a job description, get a skills checklist).
// Talks to the Debrief server. No candidate data is stored on the server.

const $ = (id) => document.getElementById(id);
const DEFAULTS = { serverUrl: 'http://localhost:8787', appToken: '' };

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

$('save-settings').addEventListener('click', async () => {
  await chrome.storage.local.set({
    serverUrl: $('server-url').value.trim().replace(/\/+$/, ''),
    appToken: $('app-token').value.trim(),
  });
  setStatus('Settings saved.');
});

// Draws the checklist with textContent only (no innerHTML).
function renderSkills(skills) {
  const list = $('skills');
  list.replaceChildren();
  for (const skill of skills) {
    const item = document.createElement('li');
    item.textContent = skill.name;
    if (skill.why) {
      const why = document.createElement('span');
      why.className = 'why';
      why.textContent = skill.why;
      item.append(why);
    }
    list.append(item);
  }
  $('checklist').hidden = skills.length === 0;
}

$('make-checklist').addEventListener('click', async () => {
  const jobDescription = $('job-description').value.trim();
  if (!jobDescription) return setStatus('Paste the job description first.', true);

  const { serverUrl, appToken } = await loadSettings();
  if (!appToken) return setStatus('Add the app token in Settings first.', true);

  const button = $('make-checklist');
  button.disabled = true;
  setStatus('Making the checklist…');
  try {
    const res = await fetch(`${serverUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appToken}` },
      body: JSON.stringify({ jobDescription }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setStatus(data.message || 'Something went wrong. Please try again.', true);
    renderSkills(data.skills || []);
    setStatus(data.skills?.length ? 'Checklist ready.' : 'No skills found. Try a fuller job description.', !data.skills?.length);
  } catch {
    setStatus('We couldn’t reach the server. Check the address in Settings.', true);
  } finally {
    button.disabled = false;
  }
});

loadSettings();
