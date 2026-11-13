// The notice for candidates: what Debrief does with their interview, in plain words. Two forms:
// written (for the invite or an email) and one sentence to say when the call starts. Pure, tested.
// The wording is a starting point: have whoever handles privacy at your company check it (#19).

export interface NoticeOptions {
  company: string; // who's interviewing; '' → "we"
  contact: string; // who to ask about their data (an email address or a name); '' → leave the line out
  retentionDays: number; // how long notes are kept; 0 → until the interviewer deletes them
}

export interface Notice {
  written: string;
  spoken: string;
}

function keptFor(days: number): string {
  if (!days || days <= 0) return 'until the interviewer deletes them';
  if (days === 365) return 'for up to a year';
  return `for up to ${days} days`;
}

export function candidateNotice({ company, contact, retentionDays }: NoticeOptions): Notice {
  const who = company.trim();
  const at = who ? ` with ${who}` : '';
  const people = who ? `People at ${who}` : 'People';
  const lines = [
    'How we take notes in your interview',
    '',
    `In your interview${at}, the interviewer uses Debrief, a note-taking tool, so they can listen to you instead of typing.`,
    '',
    '- During the call, the conversation is transcribed live. The audio goes to a speech-to-text service (Deepgram) to turn it into text. Debrief doesn’t record or keep the audio.',
    '- The transcript is deleted when the interview ends. What’s kept is the interviewer’s own notes, on their computer, ' + keptFor(retentionDays) + '.',
    '- Before the interview, an AI assistant (Anthropic’s Claude) may read your resume to suggest questions to ask. Debrief’s server doesn’t store it.',
    `- Debrief doesn’t score, rank or judge candidates. ${people} make every decision.`,
    '- If you’d rather the call isn’t transcribed, just say so, before or during the call. It won’t count against you.',
  ];
  if (contact.trim()) lines.push('', `Questions about your data: ${contact.trim()}`);
  return {
    written: lines.join('\n'),
    spoken: 'Before we start: I use a tool that transcribes this call for my notes. Nothing is recorded, and the transcript is deleted after the interview. Is that OK with you?',
  };
}
