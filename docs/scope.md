# Debrief: MVP scope

## Who it is for

Interviewers at small companies and agencies who run their own interviews, with one seat per person. Team and ATS features come later.

## Built

1. **Jobs:** several jobs, open or closed, each with a skills checklist made from the description (editable).
2. **Candidates per job:** name, email, profile link (stored, never read), interview date, resume (PDF or pasted), stage.
3. **Prepare:** an interview plan per candidate from their resume: evidence per skill, what to find out, questions, claims to check. No score.
4. **Live:** start an interview for a candidate, consent box before listening, live transcript (call tab audio → Deepgram from the browser), skills checklist with notes, follow-ups from the transcript or a typed answer, planned questions, end and save, copy notes as Markdown.
5. **Demo:** scripted interview with made-up people; no AI or saved data.
6. **Settings:** server and token, call language, theme, data retention, delete everything.

Checked in a browser with a fake server and fake Chrome APIs; not yet on a real call.

## Next steps

1. Load the extension in Chrome and run one real call (Google Meet first). Check tab capture from the side panel and that the transcript appears.
2. Check the Deepgram temporary-key flow (`/v1/auth/grant`) and the browser login against Deepgram's current docs, since neither has been tried with a live key.
3. Try `/api/plan` and `/api/resume/parse` with real resumes and tune the prompts.
4. Add a visible recording indicator, and stop listening when the call tab closes.
5. Sign-in and billing (now one shared app token); reuse Offro's Supabase and Stripe code.
6. Get data processing agreements with Deepgram and Anthropic, write the candidate notice, and get both reviewed before real candidate data.

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
