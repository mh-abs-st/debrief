# Decisions and context

Why Debrief is the way it is. Read this before changing what the AI produces, what data is kept, or the main flows. Add to it when a decision changes.

## Product

- **Name:** Debrief (owner, 2026-11-04). Sister product of Offro, which helps candidates; Debrief helps the interviewer.
- **Buyer:** small companies and agencies, one seat per interviewer, monthly.
- **Words:** a **job** is the role being hired for; a **candidate** belongs to one job; an **interview** is one call with a candidate, holding the interviewer's notes.

## The line we don't cross (EU AI Act)

- **No scores, fit labels, rankings or hire/reject recommendations** anywhere. Hiring AI that evaluates candidates is high-risk under the AI Act. Debrief supports the interviewer's judgement and never makes it.
- **The Plan is an interview plan, not a resume match** (2026-11-04). Offro's resume match gives a 0–100 fit score; Debrief doesn't. The plan shows what the resume says per skill, what to find out, questions, and claims to check. `server/lib/plan.ts` drops any score or label the model adds.
- **Follow-ups never judge the answer** and never ask about personal traits (age, family, health, religion and so on).
- **No emotion, tone or personality analysis.**

## Data

- **Saved only on the interviewer's computer** (`chrome.storage.local`): jobs, candidates, resumes, plans, notes. The server stores nothing.
- **Retention:** candidates not changed for 90 days are deleted on load (Settings: 30, 90, 180, 365 days or never). Deleting a job deletes its candidates and notes.
- **Call audio** goes from the browser straight to Deepgram with a 60-second key from our server, `mip_opt_out` on. The transcript lives in panel memory and is cleared when the interview ends; only notes are saved.
- **Listening starts with the interview** (owner, 2026-11-05). Start interview also starts listening, and the interviewer can stop and restart it at any time; the transcript continues across restarts. This replaced a consent checkbox that had to be ticked before listening. Telling the candidate is now the interviewer's job, with a reminder under Start interview; the candidate notice (issue #19) must cover it.
- **Your microphone is optional** (2026-11-13, #10). Off by default; "Include my microphone" on the listening card turns it on. It's mixed into the same audio stream as the call, so it costs nothing extra, and goes to Deepgram the same way: never stored, never played back. Lines are labelled You or Them by comparing the microphone's and the call's loudness while each line was spoken (`speakerFor` in `transcript.ts`), not Deepgram's diarization, which costs more per minute and can't tell which voice is yours. Chrome can't ask for the microphone from the side panel, so the first time, `mic.html` asks in a tab. The candidate notice (#25) should say the interviewer's voice is processed too.
- **Profile links are stored, never fetched.** Scraping LinkedIn breaks its terms and adds profiling risk.

## Technical

- **No runtime npm dependencies on the server** (2026-11-04): built while the cloud workspace couldn't reach npm. Built-in `http` and `fetch`; swapping in Express or the Anthropic SDK later is easy. Dev dependencies for type checking are fine (see TypeScript below).
- **Interview first, one page per candidate** (2026-11-05). Tabs: Interview, Upcoming, Jobs. Everything about one candidate (Plan, Interview, Notes) is on their page. The Interview tab is the current candidate's page: running interview, else the one you chose, else the next due (`currentCandidateId` in `store.ts`). Opening someone else from Upcoming or Jobs is for looking only: it never stops a running transcription, and starting them ("Interview … now") is blocked while another interview runs. Replaced Live / Prepare / Jobs / Demo, where Live and Prepare each had their own job and candidate pickers. The demo is a page reached from the empty state and Settings, not a tab.
- **TypeScript everywhere** (2026-11-05). The server and all tests run `.ts` directly with Node's type stripping (Node 22.18+), so they need no build; `tsc` only checks types. That means erasable syntax only (`erasableSyntaxOnly`): no `enum`, `namespace` or constructor parameter properties. Imports name the `.ts` file. The extension has a build step, because Chrome can't load `.ts`: `extension/src/` compiles to `extension/dist/` (load that folder unpacked). Plain `tsc`, no bundler: the output is still one ES module per file. `moduleDetection: legacy` keeps `theme-init` a classic script, which must run before the page draws.
- **Listening runs in the side panel**, not an offscreen document like Offro. Simpler; the cost is that the panel must stay open during the call. Move to Offro's offscreen engine if that turns out to be a problem.
- **No Google Fonts**: system fonts, so opening the panel doesn't send the interviewer's IP to Google (an EU privacy issue).
