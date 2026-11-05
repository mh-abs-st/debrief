// Resume upload: Claude reads the PDF and returns plain text (adapted from Offro's backend/resume.js).
// The text goes back to the browser and is stored there. The server keeps nothing.
import { asErrorLike } from './aierrors.ts';
import type { ContentBlock } from './claude.ts';

export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export const RESUME_SYSTEM = `You transcribe resumes into clean plain text for an interviewer's notes.
Keep every fact exactly as written: names, employers, titles, dates, numbers, skills, links. Do not summarize, add, judge or improve anything.
Use simple structure: section headings on their own line, one bullet per line starting with "- ", one blank line between sections.
Leave out photos and any line that only gives date of birth, age, marital status, nationality or a photo description.`;

// Rough decoded size of a base64 string.
export const base64Bytes = (b64: string): number => Math.floor((String(b64).length * 3) / 4);

export function resumeContent(pdfBase64: string): ContentBlock[] {
  return [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
    { type: 'text', text: 'Transcribe this resume as plain text.' },
  ];
}

// Messages for the panel when a PDF can't be read.
export function resumeErrorMessage(err: unknown): string {
  const e = asErrorLike(err);
  const raw = String(e.raw || e.message || '');
  if (/password|encrypt/i.test(raw)) return 'That PDF is password-protected. Remove the password and upload it again.';
  return 'We couldn’t read that PDF. Try another file, or paste the resume text instead.';
}
