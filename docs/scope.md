# Debrief: MVP scope

## Who it is for

Interviewers at small companies and agencies who run their own interviews, with one seat per person. Team and ATS features come later.

## MVP features

1. **Job setup (built):** paste a job description. The tool turns the required skills into a checklist.
2. **Live transcript (built, untested on a real call):** the call tab's audio goes to Deepgram from the browser. The panel must stay open. Needs the consent box ticked first.
3. **Coverage tracker (built):** tick each required skill as it's covered; the panel shows a count.
4. **Structured notes (built):** one notes box per skill, saved in the browser.
5. **Follow-up suggestions (built, typed answers only):** the interviewer types or pastes an answer and gets up to two follow-up questions. Not yet automatic from the transcript.
6. **After the call (built):** copy the notes as Markdown. No score.
7. **Not yet built:** automatic follow-ups from the live transcript, a quick-start line, transcript snippets in notes, a recording indicator, sign-in, and billing.
8. **Single-seat plan:** billed monthly (later).

## Next steps

1. Load the extension in Chrome and test the flow with a real call (Google Meet is the first target). Check that tab capture works in the side panel and that the transcript appears.
2. Check the Deepgram temporary-key flow (`/v1/auth/grant`) against Deepgram's current docs, since it was written without testing against the live API.
3. Add a visible recording indicator and a way to stop listening if the call ends.
4. Add sign-in and billing (currently one shared app token).
5. Get a Deepgram data processing agreement and an Anthropic one before taking real candidate data.
6. Write the candidate notice text and get it reviewed.

## Out of scope for MVP

- AI scores, rankings, or recommendations about candidates
- Tone, emotion, or personality analysis
- Candidate profiling from any source
- ATS integrations
- Long-term audio storage
- Saving transcripts anywhere other than the interviewer's browser

The "fair scorecard" is the risky part. In v1 the interviewer enters the ratings. The tool only organises the evidence.

## Compliance checklist (EU)

- **AI Act:** AI that evaluates candidates is high-risk. Confirm current obligations and deadlines with a lawyer before selling any candidate-evaluation feature. Emotion recognition in the workplace is prohibited.
- **GDPR:** define the legal basis, candidate notice, a DPIA, retention limits, and processor agreements (Deepgram, Anthropic, Supabase, Stripe). Current data flow: call audio goes browser → Deepgram directly; job descriptions and the answers you send for follow-up suggestions go to our server and then Anthropic; notes and transcripts stay in the browser.
- **ePrivacy:** check consent rules for capturing call audio.
- **VAT:** plan for EU VAT on digital services.

## Validation before building further

Talk to 8 to 10 small-company founders or agency leads who run interviews. Ask whether they would pay monthly, and what their current notes look like. If they would not pay for notes and coverage, stop.

## Reuse from Offro

- Reuse: audio capture, Deepgram, Claude streaming, side panel, on-screen card, Supabase, Stripe
- Drop: consumer credits, prep packs, translation, explain-a-term
