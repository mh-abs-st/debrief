// Demo tab: plays a scripted interview so people can see Debrief without a call, an account or a job.
// Uses only demo-script.js. It never reads or changes your real jobs, candidates or notes.
import { $, el } from './ui.js';
import { DEMO_JOB, DEMO_CANDIDATE, DEMO_PLAN, DEMO_LENGTH_MS, demoAt } from './demo-script.js';

let timer = null;
let startedAt = 0;

export function initDemo() {
  $('demoJob').textContent = `${DEMO_JOB.title} · ${DEMO_JOB.company}`;
  $('demoName').textContent = DEMO_CANDIDATE.name;
  $('demoPlay').addEventListener('click', play);
  renderPlan();
  draw(demoAt(-1));
}

// Stops the demo when you leave the tab.
export function stopDemo() {
  clearInterval(timer);
  timer = null;
  $('demoPlay').textContent = 'Play the demo';
}

function play() {
  stopDemo();
  startedAt = Date.now();
  $('demoPlay').textContent = 'Restart';
  timer = setInterval(tick, 250);
  tick();
}

function tick() {
  const state = demoAt(Date.now() - startedAt);
  draw(state);
  if (state.done) {
    clearInterval(timer);
    timer = null;
    $('demoPlay').textContent = 'Play again';
  }
}

function draw({ lines, covered, suggestions }) {
  const total = DEMO_JOB.skills.length;
  $('demoCoverage').textContent = `${covered.size} of ${total} covered`;
  $('demoCoverBar').style.width = `${Math.round((covered.size / total) * 100)}%`;

  $('demoSkills').replaceChildren(
    ...DEMO_JOB.skills.map((s, i) =>
      el(
        'li',
        { class: covered.has(i) ? 'covered' : '' },
        el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: covered.has(i), disabled: true }), el('span', {}, s.name)),
        el('span', { class: 'why' }, s.why),
      ),
    ),
  );

  const box = $('demoTranscript');
  box.replaceChildren(
    ...(lines.length
      ? lines.map((l) => el('p', { class: `line ${l.who}` }, el('span', { class: 'who' }, l.who === 'you' ? 'You' : 'Sam'), l.text))
      : [el('p', { class: 'placeholder' }, 'Press Play to watch a short made-up interview.')]),
  );
  box.scrollTop = box.scrollHeight;

  $('demoSuggestBox').hidden = !suggestions.length;
  $('demoSuggestions').replaceChildren(...suggestions.map((q) => el('li', {}, q)));
}

function renderPlan() {
  $('demoPlanList').replaceChildren(
    el('li', {}, el('span', { class: 'tag' }, 'Start'), DEMO_PLAN.opening),
    ...DEMO_PLAN.skills.map((s) =>
      el('li', {}, el('span', { class: 'tag' }, s.name), s.questions[0], el('span', { class: 'why' }, `Resume: ${s.resumeShows || 'not mentioned'}`)),
    ),
  );
}

export const demoLengthSeconds = Math.round(DEMO_LENGTH_MS / 1000);
