// Browser side of live transcription: the call tab's audio goes straight from this browser to Deepgram.
// Runs in the side panel. The panel must stay open during the call.
import { listenUrl, applyMessage, emptyTranscript } from './transcript.js';

const KEEP_ALIVE_MS = 8000;
const CHUNK_MS = 250;

// Starts listening to one tab. Calls onTranscript(transcript) as lines arrive and onStatus(text, isError).
// Returns { stop() }. Throws a user-facing Error if it can't start.
export async function startListening({ tabId, language = 'en', getKey, onTranscript, onStatus }) {
  // 1. Get the tab's audio. The tab goes quiet for the user, so we also play it back below.
  // Chrome only allows this after the Debrief icon was clicked on that tab (it grants access to the tab).
  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch {
    throw new Error('Click the Debrief icon in Chrome’s toolbar while you’re on the call tab, then press Start listening again.');
  }
  const tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false,
  });

  const ctx = new AudioContext();
  ctx.createMediaStreamSource(tabStream).connect(ctx.destination);

  // 2. Get a short-lived key just before connecting, because it expires quickly.
  let key;
  try {
    ({ key } = await getKey());
  } catch (err) {
    tabStream.getTracks().forEach((t) => t.stop());
    await ctx.close();
    throw new Error(err?.message || 'We couldn’t start listening. Please try again.');
  }

  // 3. Connect to Deepgram. The key goes in the subprotocol, as Deepgram's browser auth expects.
  const ws = new WebSocket(listenUrl({ language }), ['token', key]);
  ws.binaryType = 'arraybuffer';

  let transcript = emptyTranscript();
  let recorder = null;
  let keepAlive = null;
  let stopped = false;

  // Chunks are pieces of one audio file: send them in order, or words are lost.
  let queue = Promise.resolve();
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';

  function cleanup() {
    if (keepAlive) clearInterval(keepAlive);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    tabStream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  }

  ws.onopen = () => {
    recorder = new MediaRecorder(tabStream, { mimeType: mime, audioBitsPerSecond: 64000 });
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
    keepAlive = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'KeepAlive' }));
    }, KEEP_ALIVE_MS);
    onStatus('Listening', false);
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    const next = applyMessage(transcript, msg);
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
