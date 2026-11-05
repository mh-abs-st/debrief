// Pure transcript logic: the Deepgram connection URL and how results become lines in the panel.
// No Chrome or DOM APIs, so it can be tested in Node.

export const DEEPGRAM_MODEL = 'nova-3';

export interface TranscriptLine {
  text: string;
  final: boolean;
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
  channel?: { alternatives?: Array<{ transcript?: string }> };
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
export function applyMessage(transcript: Transcript, msg: DeepgramMessage | null | undefined): Transcript {
  if (msg?.type !== 'Results') return transcript;
  const text = (msg.channel?.alternatives?.[0]?.transcript || '').trim();
  if (!text) return transcript;

  if (msg.is_final) {
    return { lines: [...transcript.lines, { text, final: true }], interim: '' };
  }
  return { ...transcript, interim: text };
}

// Plain text of the whole transcript, for copying or for the notes.
export function transcriptText(transcript: Transcript): string {
  const parts = transcript.lines.map((l) => l.text);
  if (transcript.interim) parts.push(transcript.interim);
  return parts.join('\n');
}

// The last few final lines (the candidate's most recent answer, roughly), for follow-up suggestions.
export function recentText(transcript: Transcript, maxLines = 6): string {
  return transcript.lines.slice(-maxLines).map((l) => l.text).join(' ');
}
