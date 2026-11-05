// The Demo tab's scripted interview. Made-up people and company; no AI, no server, no real data.
// Pure data plus one function, so it can be tested in Node.

export const DEMO_JOB = {
  title: 'Backend Engineer',
  company: 'Northwind (example)',
  skills: [
    { name: 'Node.js APIs', why: 'Builds and runs the public API' },
    { name: 'PostgreSQL', why: 'Owns the main database' },
    { name: 'Testing', why: 'Keeps releases safe' },
    { name: 'Working with product', why: 'Turns requests into plans' },
  ],
};

export const DEMO_CANDIDATE = { name: 'Sam Rivera (example)' };

export const DEMO_PLAN = {
  opening: 'What have you been working on most recently?',
  skills: [
    { name: 'Node.js APIs', resumeShows: 'Built the orders API at a delivery startup (Node, Express).', askAbout: 'Their own part, and how they handled load.', questions: ['Walk me through a slow endpoint you fixed. What did you change?'] },
    { name: 'PostgreSQL', resumeShows: '“Cut query times by 60%.”', askAbout: 'How the 60% was measured.', questions: ['How did you find which queries to fix first?'] },
    { name: 'Testing', resumeShows: '', askAbout: 'Not on the resume. Ask directly.', questions: ['How do you decide what to test before a release?'] },
    { name: 'Working with product', resumeShows: 'Worked with a product manager on checkout.', askAbout: 'How they push back on scope.', questions: ['Tell me about a time you changed a feature request. What happened?'] },
  ],
  verify: [{ claim: 'Cut query times by 60%', question: 'What was the before and after, and how did you measure it?' }],
};

// at: milliseconds from the start. who: 'you' (the interviewer) or 'them' (the candidate).
// cover: index of a skill this line covers. suggest: follow-ups that appear after this line.
export const DEMO_STEPS = [
  { at: 0, who: 'you', text: 'Thanks for joining, Sam. Before we start: this call is transcribed for my notes. Is that OK?' },
  { at: 2500, who: 'them', text: 'Sure, that’s fine.' },
  { at: 4500, who: 'you', text: 'What have you been working on most recently?' },
  { at: 7000, who: 'them', text: 'I’ve been on the orders API. It’s Node and Express, and last quarter I rewrote the checkout endpoint because it slowed down at lunch peaks.' },
  { at: 11000, who: 'them', text: 'I moved the price calculation into a cache and added a queue for the emails, so the response time dropped a lot.', cover: 0, suggest: ['How did you check the cached prices stayed correct?', 'What did “dropped a lot” look like in numbers?'] },
  { at: 16000, who: 'you', text: 'Your resume says you cut query times by 60 percent. How did you find which queries to fix?' },
  { at: 19500, who: 'them', text: 'We turned on slow query logging, and three queries were most of the time. Two needed an index, one needed a rewrite.', cover: 1 },
  { at: 24000, who: 'them', text: 'The 60 percent was the average across those three, from the logs, a week before and a week after.' },
  { at: 28500, who: 'you', text: 'How do you decide what to test before a release?' },
  { at: 31500, who: 'them', text: 'Anything that touches money gets tests first. For the checkout change I wrote tests for the price rules before I changed them.', cover: 2, suggest: ['What broke anyway, and how did you find out?'] },
];

export const DEMO_LENGTH_MS = DEMO_STEPS[DEMO_STEPS.length - 1].at + 3000;

// What the demo shows `elapsed` ms after it started.
export function demoAt(elapsed, steps = DEMO_STEPS) {
  const shown = steps.filter((s) => s.at <= elapsed);
  const covered = new Set(shown.filter((s) => Number.isInteger(s.cover)).map((s) => s.cover));
  const lastSuggest = [...shown].reverse().find((s) => s.suggest);
  return {
    lines: shown.map(({ who, text }) => ({ who, text })),
    covered,
    suggestions: lastSuggest ? lastSuggest.suggest : [],
    done: elapsed >= (steps.length ? steps[steps.length - 1].at + 3000 : 0),
  };
}
