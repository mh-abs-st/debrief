# Debrief

A Chrome side-panel assistant for interviewers at small companies and agencies. Keep your jobs and candidates in one place, prepare questions from each resume, take structured notes during the call, and get follow-up questions from what the candidate just said. It supports the interviewer's judgement and never makes the decision.

**Status:** MVP. Every page works with a fake server in a browser test. Not yet tried on a real call or against the live AI and speech services; see the To-Do in `docs/scope.md` and [GitHub Issues](https://github.com/mh-abs-st/debrief/issues).

## How it's organised

The interview comes first. Everything is about one candidate at a time, and each candidate has one page.

- **Interview** (first tab): the current candidate's page, opened on their interview. Current means the interview that's running; otherwise the candidate you chose with "Interview … now"; otherwise the next one due today or later. After you end an interview it shows your notes, then moves on to the next candidate once you leave the tab.
- **Upcoming** (tab): who you're interviewing next, across all open jobs: in progress, today, coming up, date passed, no date yet. Candidates already interviewed stay in Jobs.
- **Jobs** (tab): your jobs (open or closed), each with a skills checklist made from the job description and editable by hand, and its candidates: name, email, profile link, interview date, resume (PDF upload or pasted text), and stage.
- **A candidate's page** (the Interview tab, or tap anyone in Upcoming or Jobs to look at theirs): name, job and interview time, with three parts. Looking at someone else never touches the running interview; their Interview part offers "Interview … now" instead (only when no other interview is running).
  - **Plan:** an interview plan: what the resume shows for each required skill, what to find out, questions to ask, and claims to check. No score or fit label.
  - **Interview:** start the interview, confirm the candidate agreed to transcription, then listen. Tick skills as you cover them, write notes per skill, get follow-up questions from the transcript or a typed answer.
  - **Notes:** every finished interview with what you wrote, to read or copy as Markdown.
- **Demo:** a short scripted interview with made-up people. No call, AI, account, or saved data. Opens from the empty Interview tab or from Settings.
- **Settings** (gear icon): server address and app token, call language, theme, how long candidate data is kept, and deleting everything.

The panel reopens where you left it, so closing it mid-interview brings you back to that interview.

## Principles

- The tool supports the interviewer. It does not score, rank, or recommend candidates.
- No emotion, tone or personality analysis.
- Listening can't start until the interviewer confirms the candidate knows the call is transcribed.
- Call audio goes from the browser to the speech service and is never stored. The transcript is cleared when the interview ends.
- Jobs, candidates, resumes, plans and notes are saved only on the interviewer's computer, and deleted automatically after the retention period in Settings (90 days by default).
- Profile links are only stored so you can open them. Debrief never reads or scrapes the page.

## Structure

Everything is TypeScript. The server and the tests run the `.ts` files directly (Node 22.18+ strips the types); only the extension has a build step, because Chrome can't load `.ts`.

- `extension/`: Chrome extension (Manifest V3). Sources in `extension/src/`; `npm run build` compiles them with `tsc` into `extension/dist/`, the folder you load in Chrome.
  - `panel.html|css|ts`: the side panel; `panel.ts` handles navigation (the `Nav` in `ui.ts`) and remembers where you were.
  - Views: `upcoming-view.ts`, `jobs-view.ts`, `candidate-view.ts` (a candidate's page and its Notes, as the Interview tab or opened from a list) with `plan-view.ts` and `interview-view.ts` for its other parts, `demo-view.ts`, `settings-view.ts`. Shared: `ui.ts` (safe DOM helpers, sheets, toasts, navigation types), `api.ts` (server calls, typed per route), `data.ts` (saving to `chrome.storage.local`, settings).
  - Pure logic, tested in Node: `store.ts` (data types; jobs, candidates, interviews, who's upcoming and current, retention, Markdown notes), `transcript.ts` (Deepgram URL and transcript merging), `demo-script.ts`.
  - `capture.ts`: records the call tab and streams audio straight to Deepgram.
- `server/`: Node backend (Node 22.18+). No runtime npm dependencies: the built-in HTTP server and `fetch`. TypeScript is a dev dependency, for type checking only.
  - `lib/app.ts`: routes, auth, CORS. `lib/prompts.ts`: skills and follow-up prompts. `lib/plan.ts`: the interview plan prompt and output cleaning. `lib/resume.ts`: reading PDF resumes. `lib/claude.ts`: Anthropic client. `lib/deepgram.ts`: short-lived speech keys. `lib/aierrors.ts`: adapted from Offro for friendly errors.
- `docs/`: `scope.md` (MVP, compliance, next steps) and `DECISIONS.md` (why things are the way they are).

## Run it locally

1. Server:

   ```bash
   cd server
   npm install            # dev tools only (TypeScript), for npm run typecheck
   cp .env.example .env   # fill in ANTHROPIC_API_KEY, DEEPGRAM_API_KEY and DEBRIEF_APP_TOKEN
   npm start              # node --env-file=.env index.ts
   ```

2. Tests and type checks (no network, API keys or Chrome needed):

   ```bash
   cd server && npm test && npm run typecheck
   cd ../extension && npm test && npm run typecheck
   ```

3. Extension:

   ```bash
   cd extension
   npm install
   npm run build          # or npm run watch while you work
   ```

   Open `chrome://extensions`, turn on Developer mode, choose "Load unpacked", and select the `extension/dist/` folder. After each rebuild, press the reload icon on the Debrief card. Open Settings in the side panel and paste the same `DEBRIEF_APP_TOKEN`.

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
