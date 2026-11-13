// Pure transcript logic: the Deepgram connection URL and how results become lines in the panel.
// No Chrome or DOM APIs, so it can be tested in Node.

export const DEEPGRAM_MODEL = 'nova-3';

// Who said a line: you (the interviewer's microphone) or them (the call). Only set when the
// microphone is included; otherwise lines have no speaker.
export type Speaker = 'you' | 'them';

export interface TranscriptLine {
  text: string;
  final: boolean;
  speaker?: Speaker;
}

// Final lines are kept; the newest interim line is replaced as speech continues.
export interface Transcript {
  lines: TranscriptLine[];
  interim: string;
}

// The parts of a Deepgram live message we read. Anything else in the message is ignored.
export interface DeepgramMessage {
  type?: string;
  is_final?: boolean;
  start?: number; // seconds from the start of the audio stream
  duration?: number;
  channel?: { alternatives?: Array<{ transcript?: string }> };
}

// How loud the microphone and the call were at one moment: t in seconds from the start of the audio
// stream (the same clock as Deepgram's start), levels as RMS from 0 to 1.
export interface LevelSample {
  t: number;
  mic: number;
  tab: number;
}

// Below this RMS the microphone counts as silent (room noise, a muted mic).
export const MIC_SILENCE = 0.03;

// Who spoke between start and end (seconds), from how loud the microphone was against the call.
// The microphone goes through Chrome's echo cancellation, so the call's sound coming out of the
// speakers doesn't count much on it. You: the mic was clearly louder. Undefined when there are no samples.
export function speakerFor(levels: LevelSample[], start: number, end: number): Speaker | undefined {
  const span = levels.filter((l) => l.t >= start && l.t <= end);
  if (!span.length) return undefined;
  const mean = (key: 'mic' | 'tab') => span.reduce((sum, l) => sum + l[key], 0) / span.length;
  const mic = mean('mic');
  const tab = mean('tab');
  return mic > MIC_SILENCE && mic > tab * 1.5 ? 'you' : 'them';
}

// Query string for Deepgram live speech-to-text. mip_opt_out keeps call audio out of model training.
export function listenUrl({ language = 'en' }: { language?: string } = {}): string {
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    language,
    smart_format: 'true',
    punctuate: 'true',
    interim_results: 'true',
    utterance_end_ms: '1200',
    endpointing: '400',
    mip_opt_out: 'true',
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

export function emptyTranscript(): Transcript {
  return { lines: [], interim: '' };
}

// Applies one Deepgram message. Returns the new transcript (the input is not changed).
// whoSpoke(start, end), when given, labels each final line (see speakerFor).
export function applyMessage(
  transcript: Transcript,
  msg: DeepgramMessage | null | undefined,
  whoSpoke?: (start: number, end: number) => Speaker | undefined,
): Transcript {
  if (msg?.type !== 'Results') return transcript;
  const text = (msg.channel?.alternatives?.[0]?.transcript || '').trim();
  if (!text) return transcript;

  if (msg.is_final) {
    const line: TranscriptLine = { text, final: true };
    if (whoSpoke && typeof msg.start === 'number' && typeof msg.duration === 'number') {
      const speaker = whoSpoke(msg.start, msg.start + msg.duration);
      if (speaker) line.speaker = speaker;
    }
    return { lines: [...transcript.lines, line], interim: '' };
  }
  return { ...transcript, interim: text };
}

// Plain text of the whole transcript, for copying or for the notes.
export const SPEAKER_LABELS: Record<Speaker, string> = { you: 'You', them: 'Them' };

export function transcriptText(transcript: Transcript): string {
  const parts = transcript.lines.map((l) => (l.speaker ? `${SPEAKER_LABELS[l.speaker]}: ${l.text}` : l.text));
  if (transcript.interim) parts.push(transcript.interim);
  return parts.join('\n');
}

// The candidate's most recent answer, roughly, for follow-up suggestions: the last few final lines.
// With speaker labels, only what they said since your last line (or the last few of theirs).
export function recentText(transcript: Transcript, maxLines = 6): string {
  const lines = transcript.lines;
  if (!lines.some((l) => l.speaker)) return lines.slice(-maxLines).map((l) => l.text).join(' ');
  let from = lines.length;
  while (from > 0 && lines[from - 1].speaker !== 'you') from--;
  const answer = from < lines.length ? lines.slice(from) : lines.filter((l) => l.speaker !== 'you');
  return answer.slice(-maxLines).map((l) => l.text).join(' ');
}

// Your last line, when lines are labelled: the question you most likely just asked.
export function lastQuestion(transcript: Transcript): string {
  for (let i = transcript.lines.length - 1; i >= 0; i--) {
    if (transcript.lines[i].speaker === 'you') return transcript.lines[i].text;
  }
  return '';
}
