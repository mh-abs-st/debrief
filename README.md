# Debrief

A Chrome side-panel assistant for interviewers at small companies and agencies. Keep your jobs and candidates in one place, prepare questions from each resume, take structured notes during the call, and get follow-up questions from what the candidate just said. It supports the interviewer's judgement and never makes the decision.

**Status:** MVP. Every tab works with a fake server in a browser test. Not yet tried on a real call or against the live AI and speech services; see Next steps in `docs/scope.md`.

## The tabs

- **Live:** pick a job and candidate, start the interview, confirm the candidate agreed to transcription, then listen. Tick skills as you cover them, write notes per skill, get follow-up questions from the transcript or a typed answer. End the interview to save the notes with the candidate.
- **Prepare:** pick a candidate and make an interview plan: what the resume shows for each required skill, what to find out, questions to ask, and claims to check. No score or fit label.
- **Jobs:** your jobs (open or closed), each with a skills checklist made from the job description and editable by hand, and its candidates: name, email, profile link, interview date, resume (PDF upload or pasted text), and stage.
- **Demo:** a short scripted interview with made-up people. No call, AI, account, or saved data.
- **Settings** (gear icon): server address and app token, call language, theme, how long candidate data is kept, and deleting everything.

## Principles

- The tool supports the interviewer. It does not score, rank, or recommend candidates.
- No emotion, tone or personality analysis.
- Listening can't start until the interviewer confirms the candidate knows the call is transcribed.
- Call audio goes from the browser to the speech service and is never stored. The transcript is cleared when the interview ends.
- Jobs, candidates, resumes, plans and notes are saved only on the interviewer's computer, and deleted automatically after the retention period in Settings (90 days by default).
- Profile links are only stored so you can open them. Debrief never reads or scrapes the page.

## Structure

- `extension/`: Chrome extension (Manifest V3), plain ES modules, no build step.
  - `panel.html|css|js`: the side panel; `panel.js` wires the tabs.
  - Views: `live-view.js`, `prepare-view.js`, `jobs-view.js`, `demo-view.js`, `settings-view.js`. Shared: `picker.js` (job and candidate selects), `ui.js` (safe DOM helpers, sheets, toasts), `api.js` (server calls), `data.js` (saving to `chrome.storage.local`, settings).
  - Pure logic, tested in Node: `store.js` (jobs, candidates, interviews, retention, Markdown notes), `transcript.js` (Deepgram URL and transcript merging), `demo-script.js`.
  - `capture.js`: records the call tab and streams audio straight to Deepgram.
- `server/`: Node backend (Node 20+). No npm dependencies: the built-in HTTP server and `fetch`.
  - `lib/app.js`: routes, auth, CORS. `lib/prompts.js`: skills and follow-up prompts. `lib/plan.js`: the interview plan prompt and output cleaning. `lib/resume.js`: reading PDF resumes. `lib/claude.js`: Anthropic client. `lib/deepgram.js`: short-lived speech keys. `lib/aierrors.js`: copied from Offro for friendly errors.
- `docs/`: `scope.md` (MVP, compliance, next steps) and `DECISIONS.md` (why things are the way they are).

## Run it locally

1. Server:

   ```bash
   cd server
   cp .env.example .env   # fill in ANTHROPIC_API_KEY, DEEPGRAM_API_KEY and DEBRIEF_APP_TOKEN
   node --env-file=.env index.js
   ```

2. Tests (no network, API keys or Chrome needed):

   ```bash
   cd server && npm test
   cd ../extension && npm test
   ```

3. Extension: open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select the `extension/` folder. Open Settings in the side panel and paste the same `DEBRIEF_APP_TOKEN`.

## API

All `/api` routes need `Authorization: Bearer <DEBRIEF_APP_TOKEN>`. Without a configured token, the API refuses everything. CORS allows only `chrome-extension://` origins.

- `GET /health`: no auth, returns `{ ok: true }`.
- `POST /api/skills`: `{ jobDescription }` → `{ skills: [{ name, why }] }`.
- `POST /api/plan`: `{ title, company, description, skills, resumeText }` → `{ plan: { opening, skills: [{ name, resumeShows, askAbout, questions }], verify: [{ claim, question }] } }`. Any score or label the model adds is dropped.
- `POST /api/followups`: `{ skill, question, answer }` → `{ questions }` (at most two).
- `POST /api/resume/parse`: `{ pdfBase64 }` (up to 8 MB) → `{ text }`. Nothing is stored.
- `POST /api/transcribe-token`: → `{ key, expiresIn }`, a 60-second Deepgram key. Audio never reaches this server.

## Compliance

See `docs/scope.md`. Hiring AI is regulated in the EU. Get legal advice before selling to companies.
