---
title: Cap vs reCAPTCHA
description: How Cap compares to Google reCAPTCHA v2 and v3. A privacy-friendly, self-hosted, open-source alternative.
---

# Cap vs reCAPTCHA

reCAPTCHA is Google's CAPTCHA service, available in two main versions: v2 ("I'm not a robot") and v3 (invisible, score-based). Both require sending traffic data to Google.

## Quick verdict

If your site doesn't already depend on Google for analytics or login, there is little reason to keep reCAPTCHA. Cap matches the protection level for the vast majority of use cases without sending users to Google, without per-request quotas, and without forcing visitors through traffic-light puzzles when Google's risk score doesn't like them.

## Where reCAPTCHA still makes sense

- You're already deeply integrated with Google's identity stack and want one less vendor decision.
- You specifically need Google's behavioral risk score (v3) and have the infrastructure to act on it.
- Your team is unwilling to run any backend service, even a single Docker container.

## Where Cap is the better choice

- **Privacy.** reCAPTCHA loads scripts from `google.com` and sends user signals to Google. Cap runs entirely on your infrastructure and adds nothing third-party to your page.
- **No visual puzzles.** reCAPTCHA v2 routinely drops users into traffic-light, fire-hydrant, and crosswalk puzzles. These are increasingly easy for AI solvers and increasingly hard for humans, especially on mobile or for users on VPNs and privacy browsers.
- **Bundle size.** reCAPTCHA's client weighs 500 KB+. Cap's widget is ~20 KB.
- **No quotas.** reCAPTCHA Enterprise is metered per assessment. Cap has no per-request fee — it runs on a $5 VPS for most workloads.
- **No "suspicious user" lockouts.** v3 will silently penalize users who use Tor, VPNs, or privacy-respecting browsers. With Cap you set the difficulty; the user always has a path through.
- **Open source.** Apache 2.0. Audit, fork, deploy.

## Migration

Cap's `/siteverify` endpoint is intentionally compatible with reCAPTCHA's API shape, so most server-side migrations are a single URL swap plus a new secret. Client-side, replace the `<script src="https://www.google.com/recaptcha/api.js">` and `<div class="g-recaptcha">` with Cap's widget — see the [quickstart](../index.md) for a full walk-through.

You can also run them side-by-side during the cut-over by mounting Cap on a different element and verifying both tokens server-side until you're confident.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — the proof-of-work + instrumentation model
- [All alternatives](../alternatives.md) — full feature matrix
