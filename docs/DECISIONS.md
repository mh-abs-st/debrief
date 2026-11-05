# Decisions and context

Why Debrief is the way it is. Read this before changing what the AI produces, what data is kept, or the main flows. Add to it when a decision changes.

## Product

- **Name:** Debrief (owner, 2026-11-04). Sister product of Offro, which helps candidates; Debrief helps the interviewer.
- **Buyer:** small companies and agencies, one seat per interviewer, monthly.
- **Words:** a **job** is the role being hired for; a **candidate** belongs to one job; an **interview** is one call with a candidate, holding the interviewer's notes.

## The line we don't cross (EU AI Act)

- **No scores, fit labels, rankings or hire/reject recommendations** anywhere. Hiring AI that evaluates candidates is high-risk under the AI Act. Debrief supports the interviewer's judgement and never makes it.
- **Prepare makes an interview plan, not a resume match** (2026-11-04). Offro's resume match gives a 0–100 fit score; Debrief doesn't. The plan shows what the resume says per skill, what to find out, questions, and claims to check. `server/lib/plan.js` drops any score or label the model adds.
- **Follow-ups never judge the answer** and never ask about personal traits (age, family, health, religion and so on).
- **No emotion, tone or personality analysis.**

## Data

- **Saved only on the interviewer's computer** (`chrome.storage.local`): jobs, candidates, resumes, plans, notes. The server stores nothing.
- **Retention:** candidates not changed for 90 days are deleted on load (Settings: 30, 90, 180, 365 days or never). Deleting a job deletes its candidates and notes.
- **Call audio** goes from the browser straight to Deepgram with a 60-second key from our server, `mip_opt_out` on. The transcript lives in panel memory and is cleared when the interview ends; only notes are saved.
- **Consent first:** Start listening stays disabled until the interviewer ticks that the candidate knows the call is transcribed.
- **Profile links are stored, never fetched.** Scraping LinkedIn breaks its terms and adds profiling risk.

## Technical

- **No runtime npm dependencies on the server** (2026-11-04): built while the cloud workspace couldn't reach npm. Built-in `http` and `fetch`; swapping in Express or the Anthropic SDK later is easy. Dev dependencies for type checking are fine (see TypeScript below).
- **TypeScript everywhere** (2026-11-05). The server and all tests run `.ts` directly with Node's type stripping (Node 22.18+), so they need no build; `tsc` only checks types. That means erasable syntax only (`erasableSyntaxOnly`): no `enum`, `namespace` or constructor parameter properties. Imports name the `.ts` file. The extension has a build step, because Chrome can't load `.ts`: `extension/src/` compiles to `extension/dist/` (load that folder unpacked). Plain `tsc`, no bundler: the output is still one ES module per file. `moduleDetection: legacy` keeps `theme-init` a classic script, which must run before the page draws.
- **Listening runs in the side panel**, not an offscreen document like Offro. Simpler; the cost is that the panel must stay open during the call. Move to Offro's offscreen engine if that turns out to be a problem.
- **No Google Fonts**: system fonts, so opening the panel doesn't send the interviewer's IP to Google (an EU privacy issue).
