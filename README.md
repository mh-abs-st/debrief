# Debrief

A Chrome side-panel assistant for interviewers. It helps the person running an interview with follow-up questions, skill coverage, and structured notes. It supports the interviewer's judgement and never makes the decision.

**Status:** early MVP. Job setup, live transcript (side panel stays open during the call), skills checklist, per-skill notes and follow-up suggestions. Not yet tested end to end with a real call; see Next steps in `docs/scope.md`.

## Principles

- The tool supports the interviewer. It does not score, rank, or profile candidates.
- No emotion or tone analysis of candidates.
- Recording is off by default. Candidates are told before any audio is captured.
- Audio is not stored long-term.

## Structure

- `extension/`: Chrome extension (Manifest V3), side panel. Plain JavaScript, no build step.
- `server/`: Node backend (Node 20+). No npm dependencies: uses the built-in HTTP server and `fetch`.
  - `lib/app.js`: routes and auth. `lib/prompts.js`: the AI prompts and output checks. `lib/claude.js`: Anthropic API client.
  - `lib/aierrors.js`: copied from Offro (`backend/aierrors.js`) so errors are friendly and never expose raw provider details.
- `extension/notes.js`: pure checklist and notes logic (tested). Notes stay in the browser.
- `extension/transcript.js`: Deepgram listen URL and transcript logic (tested).
- `extension/capture.js`: records the call tab and streams audio straight to Deepgram. Audio never passes through our server.
- `server/lib/deepgram.js`: hands out a 60-second Deepgram key, so the main key stays on the server.
- `docs/`: scope, compliance notes, decisions.

## Run it locally

1. Server:

   ```bash
   cd server
   cp .env.example .env   # fill in ANTHROPIC_API_KEY, DEEPGRAM_API_KEY and DEBRIEF_APP_TOKEN
   node --env-file=.env index.js
   ```

2. Tests (no network or API key needed):

   ```bash
   cd server && npm test
   ```

3. Extension logic tests (no Chrome needed):

   ```bash
   cd extension && npm test
   ```

4. Extension: open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select the `extension/` folder. In the side panel, open Settings and paste the same `DEBRIEF_APP_TOKEN`.

## API

All `/api` routes need `Authorization: Bearer <DEBRIEF_APP_TOKEN>`. Without a configured token, the API refuses everything.

- `GET /health`: no auth, returns `{ ok: true }`.
- `POST /api/skills`: body `{ jobDescription }`, returns `{ skills: [{ name, why }] }`.
- `POST /api/followups`: body `{ skill, question, answer }`, returns `{ questions: [...] }` (at most two).
- `POST /api/transcribe-token`: returns `{ key, expiresIn }`, a 60-second Deepgram key for the browser. The audio itself is not sent to this server.

CORS allows only `chrome-extension://` origins.

## Live transcript: what happens to call audio

- The panel captures the call tab's audio in this browser and sends it to Deepgram, with `mip_opt_out` on so Deepgram doesn't use it for model training.
- Our server never receives or stores audio, and transcript lines live only in the side panel's memory.
- The interviewer must tick a box confirming the candidate knows the call is being transcribed before listening can start.

## Compliance

See `docs/scope.md`. Hiring AI is regulated in the EU. Get legal advice before selling any feature that evaluates candidates.
