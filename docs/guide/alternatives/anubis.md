---
title: Cap vs Anubis
description: How Cap compares to Anubis, the proof-of-work scraper deterrent. When to use each.
---

# Cap vs Anubis

Anubis is a proof-of-work scraper deterrent, popular in self-hosted communities for blocking AI training crawlers and aggressive scrapers at the edge. It and Cap share the proof-of-work core, but they're aimed at different problems.

## Quick verdict

Use **Anubis** when you want to gate an entire site or path against bots and scrapers at the reverse-proxy level — usually because crawlers are eating your bandwidth. Use **Cap** when you want to gate a specific *action* — a form submission, an API call, an account creation — and let normal browsing continue freely.

## Where Anubis makes sense

- You want to put a PoW wall in front of an entire site or sub-path.
- The threat model is mass scraping or bot-driven request floods at the edge.
- You're comfortable making every visitor solve a small challenge before any page loads.

## Where Cap is the better choice

- **Per-action protection, not per-pageview.** Cap protects forms, signups, contact pages, and API endpoints — exactly where abuse converts to cost. Visitors browse normally.
- **Difficulty is per-action.** Anubis's challenge has to be small enough not to hurt every page load, which limits how high you can crank it. Cap is configured per-action, so difficulty can be set higher on signup or login forms without hurting browsing.
- **Two verification layers.** Cap layers [instrumentation challenges](../instrumentation.md) on top of PoW, so even bots that bring GPU-acceleration to the proof-of-work step still have to fake a real browser environment.
- **Standalone server with a dashboard.** Cap ships analytics, multi-site-key management, and a reCAPTCHA-compatible siteverify endpoint out of the box.
- **Widget UX.** Cap is meant to be visible to humans on a form — there's a checkbox, progress indicator, and brand surface. Anubis is a transparent gate.

## They can coexist

If you're already running Anubis in front of a site for crawler protection, you can still use Cap on individual high-value forms and API endpoints inside that site. The two solve different problems and don't conflict.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — proof-of-work + instrumentation
- [All alternatives](../alternatives.md) — full feature matrix
