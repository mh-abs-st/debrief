# Debrief

Chrome MV3 side-panel assistant for interviewers (jobs and candidates, interview plans, live transcript, notes, follow-up questions) with a Node backend. Sister product of Offro (`mh-abs-st/offro`), whose code can be reused.
**Read `docs/DECISIONS.md` first**, especially "The line we don't cross": no candidate scores, fit labels, rankings or recommendations. `docs/scope.md` has what's built and what's next.

## Layout
All TypeScript (strict). Node ≥ 22.18 runs `.ts` directly, so the server and tests have no build. Imports name the `.ts` file; erasable syntax only (no `enum`, `namespace`, parameter properties).
- `extension/`: sources in `src/`, built with `npm run build` (plain `tsc`, one ES module per file) into `dist/`. Load `dist/` unpacked.
  - `src/panel.html|css|ts`: tabs Interview (the current candidate's page: Plan, Interview, Notes), Upcoming and Jobs (both can open anyone's page to look at it); a demo page; sheets (job, candidate, settings, confirm). `panel.ts` implements the `Nav` from `ui.ts` that every view uses to move around.
  - Views: `upcoming-view.ts`, `jobs-view.ts`, `candidate-view.ts` (+ `plan-view.ts`, `interview-view.ts`), `demo-view.ts`, `settings-view.ts`. Shared: `ui.ts`, `api.ts`, `data.ts`.
  - Pure, tested: `store.ts` (also the data types), `transcript.ts`, `demo-script.ts`. Audio: `capture.ts`.
- `server/`: ESM, no runtime npm dependencies (TypeScript is dev only). `index.ts` reads env; `lib/app.ts` has the routes.

## Run and test
- Server: `cd server && cp .env.example .env`, fill keys, `npm start`.
- Tests: `cd server && npm test`, `cd extension && npm test` (node:test, no network). Types: `npm run typecheck` in each. Keep both green; add a test with every change to `store.ts`, `transcript.ts` or a server route.
- UI changes: `npm run build`, then check in Playwright against `extension/dist/panel.html` (serve it over http with `page.route`, since ES modules don't load from file://) with a stubbed `chrome` object and `page.route` for the server.

## Conventions
- Models: `FAST_MODEL` (default `claude-haiku-5-5`) for skills, follow-ups, resume reading; `ASSIST_MODEL` (`claude-sonnet-5-5`) for interview plans.
- Build DOM with `ui.ts` helpers and `textContent`; never `innerHTML` with data.
- User-facing copy: plain, short, no jargon; say what happens next. Server errors go through `lib/aierrors.ts`.
- Candidate data stays in `chrome.storage.local`. Don't add server storage without updating `docs/DECISIONS.md`.
