# Debrief: MVP scope

## Who it is for

Interviewers at small companies and agencies who run their own interviews, with one seat per person. Team and ATS features come later.

## Built

1. **Jobs:** several jobs, open or closed, each with a skills checklist made from the description (editable).
2. **Candidates per job:** name, email, profile link (stored, never read), interview date, resume (PDF or pasted), stage.
3. **Interview tab first:** opens on the running interview, or the candidate you chose, or the next one due. **Upcoming** lists who's next across open jobs, grouped by day; tap anyone to look at their page.
4. **Candidate page, Plan:** an interview plan from their resume: evidence per skill, what to find out, questions, claims to check. No score.
5. **Candidate page, Interview:** consent box before listening, live transcript (call tab audio → Deepgram from the browser), skills checklist with notes, follow-ups from the transcript or a typed answer, planned questions, end and save.
6. **Candidate page, Notes:** finished interviews with what was written; copy as Markdown.
7. **Demo:** scripted interview with made-up people; no AI or saved data. From the empty Interview tab or Settings.
8. **Settings:** server and token, call language, theme, data retention, delete everything.

Checked in a browser with a fake server and fake Chrome APIs. The Deepgram temporary-key flow works against the live service; a full real call is still to do (#7).

## To-Do

The backlog is in [GitHub Issues](https://github.com/mh-abs-st/debrief/issues): one issue per task, labelled `bug`, `enhancement`, `research`, `compliance`, `privacy` and `priority: high`. Add new work there, not here. As of 2026-11-05:

**First (`priority: high`)**
- [#1](https://github.com/mh-abs-st/debrief/issues/1) Deleting the current candidate while listening keeps transcribing the call
- [#2](https://github.com/mh-abs-st/debrief/issues/2) Save failures are silent, and storage is capped at 10 MB
- [#7](https://github.com/mh-abs-st/debrief/issues/7) Test a real call end to end (Google Meet first)
- [#9](https://github.com/mh-abs-st/debrief/issues/9) Show a clear recording indicator, and stop listening when the call tab closes

**Bugs**
- [#3](https://github.com/mh-abs-st/debrief/issues/3) Error messages never go away and cover the page
- [#4](https://github.com/mh-abs-st/debrief/issues/4) Adding an interview date to an existing candidate doesn't move them to Scheduled
- [#5](https://github.com/mh-abs-st/debrief/issues/5) Interview plan isn't marked out of date when the job's skills change
- [#6](https://github.com/mh-abs-st/debrief/issues/6) Notes typed just before closing the panel can be lost

**Product**
- [#10](https://github.com/mh-abs-st/debrief/issues/10) Capture the interviewer's microphone too, with speaker labels
- [#11](https://github.com/mh-abs-st/debrief/issues/11) Back up and restore all data
- [#12](https://github.com/mh-abs-st/debrief/issues/12) Edit notes after an interview ends, and delete a single interview
- [#15](https://github.com/mh-abs-st/debrief/issues/15) Keyboard shortcut to open Debrief on the call tab
- [#16](https://github.com/mh-abs-st/debrief/issues/16) Fill interview dates from a calendar
- [#17](https://github.com/mh-abs-st/debrief/issues/17) German interface
- [#18](https://github.com/mh-abs-st/debrief/issues/18) Sign-in and billing instead of the shared app token

**Engineering**
- [#13](https://github.com/mh-abs-st/debrief/issues/13) Run tests, type checks and the build on every push
- [#14](https://github.com/mh-abs-st/debrief/issues/14) Add extension icons and a Chrome Web Store package

**Before real candidate data**
- [#8](https://github.com/mh-abs-st/debrief/issues/8) Tune the plan and resume prompts on real resumes
- [#19](https://github.com/mh-abs-st/debrief/issues/19) Processor agreements, candidate notice and DPIA
- [#20](https://github.com/mh-abs-st/debrief/issues/20) Talk to 8 to 10 small-company founders or agency leads

## Out of scope for MVP

- AI scores, rankings, fit labels or hire/reject recommendations
- Tone, emotion or personality analysis
- Reading or scraping profile pages
- ATS integrations
- Storing audio, or storing transcripts anywhere but the interviewer's browser

## Compliance checklist (EU)

- **AI Act:** AI that evaluates candidates is high-risk, and emotion recognition at work is prohibited. Debrief organises evidence and questions only. Confirm with a lawyer that the interview plan stays outside "evaluation" before selling.
- **GDPR:** legal basis, candidate notice, a DPIA, retention limits (Settings: 90 days by default), and processor agreements (Deepgram, Anthropic, later Supabase and Stripe). Data flow: call audio goes browser → Deepgram; job descriptions, resumes (for plans and PDF reading) and answers sent for follow-ups go to our server and then Anthropic, without being stored; jobs, candidates, plans and notes stay in the browser.
- **ePrivacy:** check consent rules for capturing call audio.
- **VAT:** plan for EU VAT on digital services.

## Validation before building further

Talk to 8 to 10 small-company founders or agency leads who run interviews. Ask whether they would pay monthly, and what their current notes look like. If they would not pay for notes and coverage, stop.
