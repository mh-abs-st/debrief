// Browser side of live transcription: the call tab's audio, and the interviewer's microphone if they
// include it, goes straight from this browser to Deepgram. Runs in the side panel; it must stay open.
import { listenUrl, applyMessage, emptyTranscript, speakerFor, type DeepgramMessage, type LevelSample, type Transcript } from './transcript.ts';

const KEEP_ALIVE_MS = 8000;
const CHUNK_MS = 250;
const LEVEL_MS = 100; // how often the microphone and call levels are sampled, for You and Them labels
const LEVELS_KEPT_S = 120; // lines are labelled within seconds of being spoken; older samples are dropped

export interface ListenOptions {
  tabId: number;
  language?: string;
  // The transcript so far, when listening restarts during an interview. New lines are added to it.
  transcript?: Transcript;
  // Mix in the microphone and label lines You and Them. Needs the extension's microphone permission
  // (see mic.html); without it, listening goes on with the call only and onMicProblem says why.
  withMic?: boolean;
  onMicProblem?: (reason: 'blocked' | 'unavailable') => void;
  getKey: () => Promise<{ key: string }>;
  onTranscript: (transcript: Transcript) => void;
  onStatus: (text: string, isError: boolean) => void;
}

export interface Listening {
  stop(): void;
}

// Chrome's tab-audio constraint. It isn't in the standard MediaTrackConstraints, so it is typed here.
interface TabAudioConstraints {
  audio: { mandatory: { chromeMediaSource: 'tab'; chromeMediaSourceId: string } };
  video: false;
}

// Starts listening to one tab. Calls onTranscript(transcript) as lines arrive and onStatus(text, isError).
// Returns { stop() }. Throws a user-facing Error if it can't start.
// Chrome refused the tab: the Debrief icon (or its keyboard shortcut) wasn't used on it yet.
export class NeedsOkError extends Error {
  constructor() {
    super('Chrome needs your OK for this tab.');
    this.name = 'NeedsOkError';
  }
}

export async function startListening({ tabId, language = 'en', transcript: initial, withMic = false, onMicProblem, getKey, onTranscript, onStatus }: ListenOptions): Promise<Listening> {
  // 1. Get the tab's audio. The tab goes quiet for the user, so we also play it back below.
  // Chrome only allows this after the Debrief icon was clicked on that tab (it grants access to the tab).
  let streamId: string;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (err) {
    console.warn('[debrief] tab capture refused:', err);
    throw new NeedsOkError(); // the panel words it, with the keyboard shortcut (call-tab.ts)
  }
  const constraints: TabAudioConstraints = {
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false,
  };
  const tabStream = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);

  // The interviewer's microphone, with echo cancellation so the call coming out of the speakers isn't
  // picked up as them speaking. Never played back (you'd hear yourself).
  let micStream: MediaStream | null = null;
  if (withMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (err) {
      const name = (err as Error)?.name;
      onMicProblem?.(name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'unavailable');
    }
  }

  const ctx = new AudioContext();
  const tabSource = ctx.createMediaStreamSource(tabStream);
  tabSource.connect(ctx.destination);
  // With the microphone, Deepgram gets one stream with both mixed: one stream costs the same as the call alone.
  let sendStream = tabStream;
  let levelOf: (() => { mic: number; tab: number }) | null = null;
  if (micStream) {
    const mix = ctx.createMediaStreamDestination();
    const micSource = ctx.createMediaStreamSource(micStream);
    tabSource.connect(mix);
    micSource.connect(mix);
    sendStream = mix.stream;
    const meter = (source: MediaStreamAudioSourceNode) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      return () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        return Math.sqrt(sum / buf.length);
      };
    };
    const mic = meter(micSource);
    const tab = meter(tabSource);
    levelOf = () => ({ mic: mic(), tab: tab() });
  }

  // 2. Get a short-lived key just before connecting, because it expires quickly.
  let key: string;
  try {
    ({ key } = await getKey());
  } catch (err) {
    tabStream.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    await ctx.close();
    throw new Error((err instanceof Error && err.message) || 'We couldn’t start listening. Please try again.');
  }

  // 3. Connect to Deepgram. The key goes in the subprotocol, as Deepgram's browser auth expects.
  // It's a temporary token from /auth/grant, so the scheme is 'bearer' ('token' is for real API keys and
  // makes Deepgram drop the connection at once).
  const ws = new WebSocket(listenUrl({ language }), ['bearer', key]);
  ws.binaryType = 'arraybuffer';

  let transcript = initial ? { lines: initial.lines, interim: '' } : emptyTranscript();
  let recorder: MediaRecorder | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;
  let sampler: ReturnType<typeof setInterval> | null = null;
  const levels: LevelSample[] = [];
  // Deepgram times lines from the first audio it gets, which is when the recorder starts.
  const whoSpoke = levelOf ? (start: number, end: number) => speakerFor(levels, start, end) : undefined;
  let stopped = false;

  // Chunks are pieces of one audio file: send them in order, or words are lost.
  let queue: Promise<void> = Promise.resolve();
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';

  function cleanup() {
    if (keepAlive) clearInterval(keepAlive);
    if (sampler) clearInterval(sampler);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    tabStream.getTracks().forEach((t) => t.stop());
    micStream?.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  }

  // The tab's audio ends when the tab closes (or Chrome stops the capture): stop and say so.
  tabStream.getAudioTracks().forEach((track) =>
    track.addEventListener('ended', () => {
      if (stopped) return;
      stopped = true;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
      ws.close();
      cleanup();
      onStatus('Stopped listening: the call tab was closed or its sound stopped.', true);
    }),
  );

  ws.onopen = () => {
    recorder = new MediaRecorder(sendStream, { mimeType: mime, audioBitsPerSecond: 64000 });
    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      const read = e.data.arrayBuffer();
      queue = queue
        .then(async () => {
          const buf = await read;
          if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        })
        .catch(() => {});
    };
    recorder.start(CHUNK_MS);
    if (levelOf) {
      const sample = levelOf;
      const t0 = performance.now();
      sampler = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        levels.push({ t, ...sample() });
        while (levels.length && levels[0].t < t - LEVELS_KEPT_S) levels.shift();
      }, LEVEL_MS);
    }
    keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }, KEEP_ALIVE_MS);
    onStatus('Listening', false);
  };

  ws.onmessage = (event: MessageEvent) => {
    let msg: DeepgramMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const next = applyMessage(transcript, msg, whoSpoke);
    if (next !== transcript) {
      transcript = next;
      onTranscript(transcript);
    }
  };

  ws.onerror = () => {
    if (!stopped) onStatus('Can’t reach the speech service. Check your internet connection and try again.', true);
  };

  ws.onclose = () => {
    cleanup();
    if (!stopped) onStatus('Listening stopped. Press Start listening to continue.', true);
  };

  return {
    stop() {
      stopped = true;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'CloseStream' }));
      ws.close();
      cleanup();
      onStatus('Stopped.', false);
    },
  };
}
