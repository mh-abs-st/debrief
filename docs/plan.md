# Debrief: business and product plan

Written 2026-11-13. The GitHub milestones (P0 to P3) track the work; this file says why. Change it when a gate is passed or failed, or when buyers prove a guess wrong.

## Summary

Debrief should launch as a paid, privacy-first interview kit for small EU recruitment agencies and founder-led startups. The goal is **about €4k monthly revenue by November 2027** (around 60 agency seats plus 20 hiring passes a month), with a go-or-stop gate after each phase.

- **What it is:** a Chrome side panel that turns a job and a resume into an interview plan. During the call it tracks which skills you covered, suggests follow-up questions and keeps clean notes. No bot joins the call, nothing is recorded, and nothing about candidates is stored on our server.
- **The bet:** interview-intelligence tools are priced and built for recruiting teams with an ATS. Teams that hire a few times a year, or agencies without enterprise budgets, are left with generic meeting bots or a notepad. Debrief is structured interviewing for them, at a price that fits.
- **The line we keep:** no scores, rankings or fit labels (see `DECISIONS.md`). This is the product's ethic, and it is also what makes Debrief easy to adopt under the EU AI Act and GDPR.
- **Two offers:** a monthly **Agency seat (€49)** for people who interview every week, and a **Hiring pass (€59 per job, 30 days)** for founders who hire now and then.
- **First:** prove that a real call works end to end, and talk to 10 buyers. If they won't pay for better interviews and notes, stop.

## Where the product stands (2026-11-13)

The MVP is feature-complete for one interviewer, but it has never been used in a real call or by a real customer. It has about 3,000 lines of strict TypeScript, and the store, transcript and server routes are tested. It has been checked in a browser against a fake server.

| Area | Built | Missing before anyone pays |
| --- | --- | --- |
| Jobs and candidates | Several jobs, skills checklist from the job description, candidates with resume (PDF or text), stage, interview date | Backup and restore (#11), calendar dates (#16) |
| Plan | Interview plan per candidate: resume evidence per skill, what to find out, questions, claims to check, with any score removed | Tuning on real resumes (#8), out-of-date warning (#5) |
| Interview | Live transcript (call tab audio sent to Deepgram from the browser), checklist with notes per skill, follow-up questions | Real-call test (#7), the interviewer's own voice (#10), recording indicator (#9), phone and in-person interviews (#26) |
| Notes | Finished interviews, copy as Markdown | Editing after the call (#12), client write-up (#30) |
| Demo and Settings | Scripted demo, theme, language, retention (90 days by default), delete everything | First-run setup (#27) |
| Server | Five routes, no runtime dependencies, stores nothing, one shared app token | Hosting (#23), rate limits and metering (#24), accounts and billing (#18) |
| Distribution | Icons, Manifest V3 | CI (#13), Store package and listing (#14), website and privacy policy (#31) |

The privacy design is the strongest asset. Audio goes straight from the browser to the speech service and is never stored. The transcript is cleared when the interview ends, and candidate data stays in `chrome.storage.local`. A competitor that records calls can't easily copy this.

## Problem, customer and positioning

Interviewers at small organisations run unstructured interviews, forget to probe key skills, and spend 20 to 30 minutes after each call rebuilding notes from memory. Debrief fixes the before, the during and the after for one interviewer, without changing their call tool or adding an ATS.

Both segments are hypotheses until the buyer interviews (#20) are done.

| | Small recruitment agency (lead segment) | Founder-led startup |
| --- | --- | --- |
| Who | 1 to 15 recruiters running screening calls for client roles | Founder or team lead, 5 to 50 staff, hiring 2 to 10 people a year |
| Volume | 10 to 40 calls per recruiter per week | Bursts: 5 to 15 interviews per role, then nothing |
| Main pain | Writing up each candidate for the client takes time that isn't billable | Doesn't know what to ask; inconsistent interviews; notes nobody can use |
| Job to be done | Screen faster and send a clean, evidence-based write-up | Run a structured interview the first time and remember what was said |
| Why they pay | Hours saved every week, and a better write-up wins placements | One good hire matters a lot; the cost is tiny next to a bad one |
| Offer | Agency seat, monthly | Hiring pass per job |

**Positioning:** *the structured-interview kit that stays out of the call.* For interviewers who don't have an enterprise recruiting stack, Debrief prepares the interview, keeps you on track live and writes clean notes. Unlike meeting bots and interview-intelligence suites, it doesn't record, join or score, and candidate data stays on your computer.

**What we won't build:** scores, rankings, sentiment or personality reads, profile scraping, or storing audio.

## Market and competitors

The category leaders sell to recruiting teams with an ATS, at prices small teams find hard to justify.

| Alternative | Price signal | Where Debrief differs |
| --- | --- | --- |
| [Metaview](https://www.eesel.ai/blog/metaview-pricing) | Notes Pro about $60 per user a month; reviewers say per-seat pricing is hard to justify when hiring a few roles a year ([Beri](https://www.beri.net/tools/metaview)) | No ATS needed, nothing recorded, a per-job pass for occasional hiring |
| [BrightHire](https://vendr.com/marketplace/brighthire) | Custom quotes; small teams typically $15k to $35k a year (Vendr data) | Self-serve, a fraction of the cost, no sales call |
| Meeting bots (Otter, Fireflies and similar) | Cheap per seat | Not built for interviews: no plan, no skills coverage, the bot joins and records |
| ATS built-in AI notes | Bundled | Only if you already use that ATS; agencies often work in the client's tools |
| Notepad or Google Doc | Free | The real competitor: we must save more time than it costs to set up |

No market size until the buyer interviews are done. The plan needs fewer than 100 accounts, so what matters is whether agencies pay and how fast word of mouth spreads.

## Pricing and unit economics

| Plan | Price | Includes | For |
| --- | --- | --- | --- |
| Try | Free | Demo any time, plus 3 real interviews with everything on, no card | Everyone |
| Hiring pass | €59 per job, 30 days | One job, unlimited candidates, up to 20 hours of listening | Founders and teams hiring occasionally |
| Agency seat | €49 a month, or €39 a month billed yearly | All jobs, 30 hours of listening a month (fair use), client write-ups | Recruiters interviewing every week |
| Founding partner | 50% off the first year | Design partners from the private beta | First 10 to 20 accounts |

Cost per active user a month is an estimate, to check against real usage in the beta. Deepgram Nova-3 streaming costs $0.0048 to $0.0092 a minute (promotional or regular rate, single or multiple languages); speaker labels add about $0.002 a minute ([Deepgram pricing](https://deepgram.com/pricing)). AI is roughly $0.10 per candidate for plan, follow-ups and resume reading (approximate, measure it).

| Case | Listening | Speech (worst case) | AI | Cost | Price | Gross margin |
| --- | --- | --- | --- | --- | --- | --- |
| Agency seat, heavy | 40 calls × 30 min | $13.40 | $4.00 | ≈ €16 | €49 | ≈ 65 to 75% |
| Hiring pass | 15 calls × 45 min | $7.60 | $1.50 | ≈ €8 | €59 | ≈ 85% |

What these numbers decide:

- **#10:** mix the microphone into the call audio and use speaker labels. Two channels would roughly double speech cost.
- **Keep the single-language model as the default** (it already is, set by the call language in Settings). Offer multi-language only as an option; it costs 20 to 40% more.
- **Meter usage on the server from day one (#24).** Fair use only works if minutes and AI calls are counted per account.
- **VAT:** sales are mostly B2B across the EU. Choose between a merchant of record and Stripe with Stripe Tax before building billing (#18).

## Go-to-market

Founder-led and close to the customer until there are 20 paying accounts; then the Chrome Web Store, search and agency networks.

1. **Discovery (P0, to mid-December 2026).** 10 buyer interviews, 6 agencies and 4 founders (#20). Show the Demo, ask what their notes and client write-ups look like today, test both prices, recruit design partners.
2. **Private beta (P1, January to February 2027).** 10 design partners, free, 30-minute onboarding call, a short check-in each week, real calls only (#29).
3. **Paid launch (P2, March to April 2027).** Billing, public Store listing, website with pricing (#31), founding price for partners, one referral and a quote from each happy partner.
4. **Grow (P3, May 2027 onward).** Search pages (interview questions per role, client write-ups, AI Act-safe notes), a free questions-from-a-job-description tool (#36), agency networks in Hungary and DACH, founder posts on LinkedIn.

English across the EU first, then German (#17) once DACH partners ask for it. Keep Debrief's brand separate from Offro's: interviewers should never wonder whether candidate data flows to a candidate-side product.

## Roadmap

Each phase ends in a go-or-stop gate. The GitHub milestones match the phases.

| Phase | Dates | Main work | Gate at the end |
| --- | --- | --- | --- |
| P0 Prove it works | to 2026-12-18 | Real call (#7), buyer calls (#20), bugs (#3 to #6), recording indicator (#9), prompts (#8), CI (#13), this doc (#37) | At least 5 of 10 buyers show a clear pay signal; 3 real calls of 30+ minutes run cleanly |
| P1 Private beta | to 2027-02-26 | Design partners (#29), EU hosting (#23), rate limits (#24), candidate notice (#25), DPIA and contracts (#19), microphone (#10), first-run setup (#27), no-listening mode (#26), usage counts (#28) | 6 of 10 partners finish an interview every week, 4 weeks running |
| P2 Paid launch | to 2027-04-30 | Sign-in and billing (#18), website (#31), client write-up (#30), public Store listing, AI Act legal opinion, German (#17) | **Kill criterion:** at least 10 paying accounts and gross margin of 70% or more |
| P3 Grow | to 2027-10-29 | Calendar (#16), interview kits (#32), free web tool (#36), Edge (#33), research on sharing (#34) and ATS export (#35) | About €4k monthly revenue by November 2027 |

Team sharing and ATS links stay research until customers ask, because they would mean storing candidate data on a server.

## Compliance and trust

Compliance is part of what we sell, so it is done before real candidate data goes in. The biggest open question: does the interview plan count as "evaluating candidates" under the AI Act? Get a lawyer's written opinion before the paid launch (#19).

- **AI Act timing:** the Digital Omnibus moved high-risk obligations for employment AI from 2 August 2026 to 2 December 2027 ([JD Supra](https://www.jdsupra.com/legalnews/the-eu-moves-to-slim-down-and-delay-8489305/)). The classification didn't change ([viso.ai](https://viso.ai/deep-learning/digital-omnibus-ai/)). Debrief stays out of that class: no evaluation, filtering or ranking, and the reasons are written down.
- **If the plan is high-risk:** keep it as questions only (no "resume shows" per skill), or budget for conformity work, which one estimate puts at €20k to €50k per system ([Forkast](https://forkast.news/?p=128196)).
- **GDPR:** processor agreements (Deepgram, Anthropic, later auth and billing), a DPIA, a privacy policy, and a ready-made candidate notice in the product (#25).
- **Trust on the website:** what leaves the browser and where it goes, no bot and no recording, retention in the interviewer's hands, EU hosting, no scores.
- **Chrome Web Store:** `tabCapture` and audio need a clear single-purpose description and privacy disclosures (#14).

## Metrics, risks and kill criteria

One number leads: **weekly active interviewers**, people who finish at least one real interview a week. Usage counts are opt-in and anonymous and never include candidate data (#28).

| Metric | Definition | Beta target | Launch target |
| --- | --- | --- | --- |
| Activation | Install to first finished real interview within 7 days | 60% of partners | 40% of installs |
| Weekly active interviewers | At least 1 finished interview that week | 6 of 10 partners, 4 weeks running | 70% of paying seats |
| Notes used | Interviews whose notes are copied or exported | 50% | 60% |
| Paid conversion | Trial to paid within 30 days | | 15% |
| Monthly logo churn | Agency accounts lost per month | | under 4% |
| Gross margin | Revenue minus speech, AI, payments and hosting | measured | 70% or more |

| Risk | Early sign | Response |
| --- | --- | --- |
| Buyers won't pay for notes and coverage | Fewer than 5 of 10 discovery calls show a clear pay signal | Stop |
| Capture breaks on Meet, Zoom or Teams web | Dropped words or audio problems in #7 | Fix, or notes-only for that tool (#26) |
| AI Act classes the plan as high-risk | Lawyer's opinion | Questions-only plan, or stop selling the plan |
| Chrome Web Store rejects the listing | Review feedback | Narrower permissions, clearer disclosures |
| Speech costs rise when promotions end | Deepgram pricing changes | Single-language model, fair-use caps, or another provider |
| ATS vendors bundle AI notes | Losing deals to "we already have it" | Focus on agencies working across client tools, and on privacy |

**Kill criteria:** stop or pivot if discovery fails its gate, or if there are fewer than 10 paying accounts by 30 April 2027.
