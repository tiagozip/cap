---
title: Cap vs hCaptcha
description: How Cap compares to hCaptcha. A self-hosted, puzzle-free, free-at-scale open-source alternative.
---

# Cap vs hCaptcha

hCaptcha is the privacy-positioned, puzzle-based competitor to reCAPTCHA. The free tier shows image puzzles aggressively; the paid Pro tier ($99/mo annual, $139/mo monthly, 100k evaluations) unlocks a mostly-passive mode and analytics. It's the most aggressive of the major CAPTCHAs about visible puzzles on the free plan.

## Quick verdict

If you're using hCaptcha primarily because you wanted to leave Google, Cap is the simpler step. You don't trade Google for a different third party — you stop having a third party at all. And you stop charging your users a "puzzle tax" on every form submission.

## Where hCaptcha makes sense

- You specifically need hCaptcha Enterprise's threat-intel feed and risk-scoring at scale, and you have the budget for it.
- You're already deeply integrated and the migration cost outweighs the benefits.
- Your compliance program specifically requires a visible-puzzle human-verification step for regulated actions.

## Where Cap is the better choice

- **No image puzzles.** hCaptcha's drop-off rate on puzzles ranges from **5% to 15%** depending on difficulty. That's real conversion you're losing on signups, checkouts, and contact forms. Cap never shows a puzzle. (Hcaptcha Pro's passive mode reduces this, but it's a paid plan.)
- **Bundle size.** hCaptcha's client is 600 KB+. Cap is ~20 KB — about 30× smaller.
- **No quota or overage.** hCaptcha Pro starts at $99/mo for 100k evaluations and bills $0.99 per 1k after that. Cap is free at any scale, runs on a $5 VPS, no per-request fee.
- **Self-hosted.** No third-party dependency. Cap doesn't load anything from `hcaptcha.com`.
- **No fingerprinting.** hCaptcha relies on browser fingerprints and behavioral signals; that hurts users on privacy browsers. Cap's proof-of-work works the same regardless of browser.
- **Open source.** Apache 2.0. Audit it, run it on air-gapped infra, fork it.

## Where they're similar

Both run an instrumentation/behavioral layer in addition to the visible challenge. Both have invisible modes available. Both work with the standard form-submission pattern.

## Migration

Cap's `/siteverify` is API-shape compatible with hCaptcha's. Most backend changes are a URL swap. On the client, replace `<div class="h-captcha">` and `https://js.hcaptcha.com/1/api.js` with Cap's `<cap-widget>` — see the [quickstart](../index.md).

If you want to migrate gradually, run Cap on new forms first, keep hCaptcha on legacy ones, and watch the conversion delta.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — proof-of-work + instrumentation
- [All alternatives](../alternatives.md) — full feature matrix
