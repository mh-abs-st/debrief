# Chrome Web Store listing

What to paste into the [Chrome Web Store developer console](https://chrome.google.com/webstore/devconsole) for Debrief. Keep it in step with `docs/scope.md`, `docs/DECISIONS.md` and the privacy policy (#31): reviewers compare the listing, the permissions and the policy.

**Package:** `cd extension && npm run package -- https://<production server>` writes `extension/release/debrief-<version>.zip`. It swaps `http://localhost:8789` for the production server in `host_permissions`, the default setting and the placeholder, and refuses if any development address is left. Raise `version` in `extension/src/manifest.json` for every upload.

**Visibility:** *Unlisted* for the private beta (#29), *Public* at the paid launch.

## Store listing

- **Name:** Debrief
- **Summary** (the manifest's `description`, 132 characters at most): Interview notes for hiring teams: skills checklist, live transcript, follow-up questions and plans. No candidate scores.
- **Category:** Productivity → Workflow & Planning
- **Language:** English

**Description:**

> Debrief is an interview assistant that sits in Chrome's side panel, beside any web call (Google Meet, Zoom or Teams in the browser).
>
> Before the call: add the job and its skills checklist, add the candidate's resume, and get an interview plan: what the resume shows for each skill, what to find out, questions to ask, and claims worth checking.
>
> During the call: a live transcript of the call tab (and your microphone, if you include it), the skills checklist with notes per skill, and follow-up questions based on the candidate's last answer.
>
> After the call: your notes per skill, kept on your computer, ready to copy into your ATS or email.
>
> What Debrief doesn't do:
> • It never scores, ranks or labels candidates. You decide; Debrief helps you ask better questions and keep better notes.
> • No bot joins your call, and nothing is recorded. Audio goes straight from your browser to the speech service and isn't stored. The transcript is cleared when the interview ends.
> • Candidate data stays in your browser. Debrief deletes candidates after the time you choose (90 days by default), and you can delete everything at any time.
>
> Tell candidates the call is transcribed: Debrief reminds you when you start.

**Images** (in `docs/store/`, made by `docs/store/make-images.py` from the built extension; every person and company shown is made up):

| File | Use | Size |
| --- | --- | --- |
| `screenshot-live.png` | Screenshot 1: follow-up questions during the Demo | 1280 × 800 |
| `screenshot-plan.png` | Screenshot 2: an interview plan | 1280 × 800 |
| `screenshot-notes.png` | Screenshot 3: notes after the call | 1280 × 800 |
| `promo-small.png` | Small promo tile | 440 × 280 |
| `extension/src/icons/icon-128.png` | Store icon | 128 × 128 |

## Privacy practices

**Single purpose:**

> Debrief helps an interviewer run a structured job interview in a web call and keep notes: it shows a skills checklist, an interview plan and a live transcript of the call in the side panel, and suggests follow-up questions.

**Permission justifications:**

| Permission | Why Debrief needs it |
| --- | --- |
| `sidePanel` | Debrief's whole interface is the side panel, open beside the call. |
| `tabCapture` | To transcribe the call, Debrief captures the audio of the call tab when the interviewer starts listening. Only that tab, only while listening; the audio is sent to the speech service and not stored. |
| `activeTab` | Capture starts from the tab the interviewer has open when they click the Debrief icon or press Start listening. |
| `tabs` | To know which tab is the call (its address), and to stop listening when that tab is closed or goes to another site. Debrief doesn't read page content. |
| `storage` | Jobs, candidates, plans, notes and settings are stored in the browser (`chrome.storage.local`), not on a server. |
| `unlimitedStorage` | Resumes and interview notes for many candidates can exceed the default storage quota. |
| Host: our server (`https://<production server>/*`) | Makes the skills checklist, interview plans and follow-up questions, and issues short-lived keys for the speech service. It stores nothing about candidates. |
| Host: `https://api.deepgram.com/*`, `wss://api.deepgram.com/*` | The speech service: audio is streamed to it for the live transcript. |

**Remote code:** No. All code ships in the package; the server returns data (JSON), never code.

**Data usage** (what leaves the browser):

| Type | Collected? | What and why |
| --- | --- | --- |
| Personally identifiable information | Yes | Candidate names and resume text are sent to our server to make the interview plan, then discarded. |
| Personal communications | Yes | Call audio (and the interviewer's microphone, if included) is streamed to the speech service for the live transcript and not stored. Recent transcript lines are sent to our server for follow-up questions, then discarded. |
| Health, financial, authentication, location, web history, user activity, website content | No | |

Certify all three: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL:** the website's privacy policy (#31). Required before the listing can be submitted.

## Before each upload

- [ ] Version raised in `extension/src/manifest.json`
- [ ] `npm test` and `npm run typecheck` pass in `extension/` and `server/` (CI does this on every pull request)
- [ ] `npm run package -- https://<production server>` with the real server (#23)
- [ ] Loaded the zip's contents unpacked once and ran the Demo and one real call
- [ ] Screenshots still match the panel (re-run `docs/store/make-images.py` if the UI changed)
- [ ] Privacy policy (#31) and the data usage answers above still match what Debrief does
