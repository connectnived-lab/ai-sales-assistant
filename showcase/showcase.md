# AI Sales Assistant

**One-line pitch:** Score a lead with a visible rule set, get the next step, and draft outreach in one tone.

## Description

A sales helper for small teams. It scores a lead with a visible set of reasons, tells you the next step, and drafts outreach emails in the tone you choose. It runs offline with templates, and an optional live mode uses any OpenAI-compatible endpoint for a second view and a model-written draft. Plain HTML, CSS and ES modules, with unit tests and an end-to-end check.

**Tech used:** plain HTML, CSS and ES modules; Node node:test; Playwright (Python) end-to-end checks; an injectable-fetch chat-completions client

**30-second demo:** Score the sample lead Acme (Founder, 120 people, 12k, asap, replied), then draft a cold email to Ana Rao at Acme for Ledgerly and copy it.

**Resume bullets (no invented metrics):**
- Built a lead-qualification tool that scores prospects 0-100 from role, company size, budget, timing and engagement, with reasons and missing questions shown, and unit tests for each rule.
- Implemented outreach-email templates across four situations and three tones, with budget parsing for k, lakh and million formats.
- Added an optional live mode through any OpenAI-compatible endpoint that writes a second opinion and an email from the entered facts only.

**LinkedIn draft:**
I built a small sales assistant as a portfolio project. It scores a lead with a visible set of reasons, tells you what to do next, and drafts outreach in the tone you pick. It works offline out of the box, and an optional live mode can use any OpenAI-compatible model for a second view. MIT licensed, with unit tests and an end-to-end check. Repo: https://github.com/connectnived-lab/ai-sales-assistant
