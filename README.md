# Debrief

A Chrome side-panel assistant for interviewers. It helps the person running an interview with follow-up questions, skill coverage, and structured notes. It supports the interviewer's judgement and never makes the decision.

**Status:** early MVP scaffolding. Not yet usable.

## Principles

- The tool supports the interviewer. It does not score, rank, or profile candidates.
- No emotion or tone analysis of candidates.
- Recording is off by default. Candidates are told before any audio is captured.
- Audio is not stored long-term.

## Structure

- `extension/`: Chrome Extension (Manifest V3) with side panel and content script
- `server/`: Node.js backend (API, auth, billing hooks, to be added)
- `docs/`: scope, compliance notes, decisions

## Getting started

Requires Node.js 20 or later.

```bash
cd server
npm install
npm start
```

Load the extension: open `chrome://extensions`, enable Developer mode, choose "Load unpacked", and select the `extension/` folder.

## Compliance

See `docs/scope.md`. Hiring AI is regulated in the EU. Get legal advice before selling any feature that evaluates candidates.
