---
title: Cap vs Cloudflare Turnstile
description: How Cap compares to Cloudflare Turnstile. A self-hosted, fully customizable, open-source alternative.
---

# Cap vs Cloudflare Turnstile

Turnstile is Cloudflare's free CAPTCHA replacement, focused on running invisible challenges that lean heavily on Cloudflare's network signals and browser fingerprinting.

## Quick verdict

Turnstile is genuinely good if you're already on Cloudflare and accept that the verdict is theirs to make. Cap is the better fit when you want self-hosting, deterministic difficulty, no third-party dependency, and the ability to override decisions for your own users.

## Where Turnstile makes sense

- You're already routing traffic through Cloudflare and want to stay in one ecosystem.
- You don't want to host anything — Turnstile is fully managed.
- You're willing to accept Cloudflare's algorithmic decisions for "suspicious" visitors with no way to override.

## Where Cap is the better choice

- **Self-hosted.** Cap runs on your servers. Turnstile requires every challenge to round-trip through Cloudflare.
- **You own the policy.** With Turnstile, if Cloudflare's algorithm decides a user looks suspicious — common for Brave, Librewolf, Tor, or VPN users — there is no override. Cap puts the difficulty knob in your hands.
- **Lower error rate for privacy-conscious users.** Turnstile is widely reported to misclassify hardened browsers. Cap's proof-of-work doesn't care about fingerprints.
- **Open source.** Apache 2.0 vs Turnstile's closed-source client and server.
- **No telemetry.** Cap doesn't phone home and doesn't set cookies. Turnstile's client communicates with `challenges.cloudflare.com` on every page load.
- **Customizable.** Cap exposes CSS variables for colors, size, and shape. Turnstile's iframe is mostly fixed.

## Where they're similar

Both ship a small (~20–110 KB) client. Both run an "invisible" mode (Cap calls it [floating mode](../floating.md) or [programmatic mode](../programmatic.md)). Both layer behavioral checks on top of a primary challenge — Cap calls those [instrumentation challenges](../instrumentation.md), Turnstile calls them "managed challenges."

## Migration

Cap's `/siteverify` API shape is compatible with Cloudflare's `siteverify`, so server-side verification is mostly a URL and secret swap. The client-side change is replacing `<div class="cf-turnstile">` with `<cap-widget>` and pointing it at your Cap instance — see the [quickstart](../index.md) for full code.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — proof-of-work + instrumentation
- [All alternatives](../alternatives.md) — full feature matrix
