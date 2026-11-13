# Debrief: MVP scope

## Who it is for

Interviewers at small companies and agencies who run their own interviews, with one seat per person. Team and ATS features come later.

## Built

1. **Jobs:** several jobs, open or closed, each with a skills checklist made from the description (editable).
2. **Candidates per job:** name, email, profile link (stored, never read), interview date, resume (PDF or pasted), stage.
3. **Interview tab first:** opens on the running interview, or the candidate you chose, or the next one due. **Upcoming** lists who's next across open jobs, grouped by day; tap anyone to look at their page.
4. **Candidate page, Plan:** an interview plan from their resume: evidence per skill, what to find out, questions, claims to check. No score.
5. **Candidate page, Interview:** listening starts with the interview and can be stopped and restarted, live transcript (call tab audio → Deepgram from the browser), skills checklist with notes, follow-ups from the transcript or a typed answer, planned questions, end and save.
6. **Candidate page, Notes:** finished interviews with what was written; copy as Markdown.
7. **Demo:** scripted interview with made-up people; no AI or saved data. From the empty Interview tab or Settings.
8. **Settings:** server and token, call language, theme, data retention, delete everything.

Checked in a browser with a fake server and fake Chrome APIs. The Deepgram temporary-key flow works against the live service; a full real call is still to do (#7).

## To-Do

The backlog is in [GitHub Issues](https://github.com/mh-abs-st/debrief/issues), grouped by the milestones from `docs/plan.md`:

- **[P0 Prove it works](https://github.com/mh-abs-st/debrief/milestone/1):** a real call, 10 buyer interviews, the first bugs.
- **[P1 Private beta](https://github.com/mh-abs-st/debrief/milestone/2):** hosting, rate limits, candidate notice, DPIA, 10 design partners.
- **[P2 Paid launch](https://github.com/mh-abs-st/debrief/milestone/3):** sign-in and billing, website, client write-up.
- **[P3 Grow](https://github.com/mh-abs-st/debrief/milestone/4):** calendar, interview kits, more channels.

Labels: `bug`, `enhancement`, `research`, `compliance`, `privacy`, `go-to-market`, `priority: high`. Add new work there, with a milestone, not here.

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

Talk to 10 buyers, about 6 small agencies and 4 founders (#20). Ask whether they would pay, and what their current notes look like. If fewer than 5 of 10 show a clear pay signal, stop. The gates for later phases are in `docs/plan.md`.
