// Pure logic for the interview checklist and notes. No Chrome or DOM APIs, so it can be tested in Node.
// Notes stay on the interviewer's computer (chrome.storage.local). Nothing here scores a candidate.

// Turns the server's skills list into the interview's working state.
export function startInterview(skills) {
  return {
    skills: (skills || []).map((s) => ({ name: s.name, why: s.why || '', covered: false, notes: '' })),
  };
}

export function setCovered(state, index, covered) {
  const skills = state.skills.map((s, i) => (i === index ? { ...s, covered: Boolean(covered) } : s));
  return { ...state, skills };
}

export function setNotes(state, index, notes) {
  const skills = state.skills.map((s, i) => (i === index ? { ...s, notes: String(notes ?? '') } : s));
  return { ...state, skills };
}

// How many required skills have been covered so far.
export function coverage(state) {
  const total = state.skills.length;
  const covered = state.skills.filter((s) => s.covered).length;
  return { covered, total };
}

// Markdown the interviewer can copy into their own notes or ATS. Only what they typed; no assessment is added.
export function toMarkdown(state, { date = '' } = {}) {
  const { covered, total } = coverage(state);
  const lines = ['# Interview notes', ''];
  if (date) lines.push(`Date: ${date}`, '');
  lines.push(`Skills covered: ${covered} of ${total}`, '');
  for (const skill of state.skills) {
    lines.push(`## ${skill.name}`, '');
    lines.push(`- Covered: ${skill.covered ? 'yes' : 'no'}`);
    if (skill.why) lines.push(`- Why it matters: ${skill.why}`);
    lines.push('', skill.notes.trim() || '_No notes._', '');
  }
  return lines.join('\n').trimEnd() + '\n';
}
