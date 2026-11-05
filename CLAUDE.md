# Debrief

Chrome MV3 side-panel assistant for interviewers (jobs and candidates, interview plans, live transcript, notes, follow-up questions) with a Node backend. Sister product of Offro (`mh-abs-st/offro`), whose code can be reused.
**Read `docs/DECISIONS.md` first**, especially "The line we don't cross": no candidate scores, fit labels, rankings or recommendations. `docs/scope.md` has what's built and what's next.

## Layout
- `extension/`: plain ES modules, no build step. Load unpacked from this folder.
  - `panel.html|css|js`: tabs Live, Prepare, Jobs, Demo, plus sheets (job, candidate, settings, confirm).
  - Views: `live-view.js`, `prepare-view.js`, `jobs-view.js`, `demo-view.js`, `settings-view.js`. Shared: `picker.js`, `ui.js`, `api.js`, `data.js`.
  - Pure, tested: `store.js`, `transcript.js`, `demo-script.js`. Audio: `capture.js`.
- `server/`: Node ≥ 20, ESM, no npm dependencies. `index.js` reads env; `lib/app.js` has the routes.

## Run and test
- Server: `cd server && cp .env.example .env`, fill keys, `node --env-file=.env index.js`.
- Tests: `cd server && npm test`, `cd extension && npm test` (node:test, no network). Keep them green; add a test with every change to `store.js`, `transcript.js` or a server route.
- UI changes: check in Playwright against `extension/panel.html` with a stubbed `chrome` object and `page.route` for the server.

## Conventions
- Models: `FAST_MODEL` (default `claude-haiku-5-5`) for skills, follow-ups, resume reading; `ASSIST_MODEL` (`claude-sonnet-5-5`) for interview plans.
- Build DOM with `ui.js` helpers and `textContent`; never `innerHTML` with data.
- User-facing copy: plain, short, no jargon; say what happens next. Server errors go through `lib/aierrors.js`.
- Candidate data stays in `chrome.storage.local`. Don't add server storage without updating `docs/DECISIONS.md`.
