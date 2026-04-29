---
title: Cap vs FriendlyCaptcha
description: How Cap compares to FriendlyCaptcha. A free, self-hosted, open-source proof-of-work alternative.
---

# Cap vs FriendlyCaptcha

FriendlyCaptcha was an early proof-of-work CAPTCHA, focused on EU privacy compliance. It's a hosted commercial service with a free tier for non-commercial use and paid tiers for everything else.

## Quick verdict

If you specifically need a paid, EU-hosted, vendor-supported product with an SLA and a sales contact, FriendlyCaptcha is a reasonable choice. If you want the same proof-of-work model without the bill or the request quota, Cap is a free, self-hosted, open-source alternative that you control end-to-end.

## Where FriendlyCaptcha makes sense

- You need a vendor with a contract, an SLA, and EU-based hosting handled by someone else.
- Your traffic is predictable and small enough to fit comfortably in a paid tier.
- You don't want to operate any infrastructure.

## Where Cap is the better choice

- **No quotas at any volume.** FriendlyCaptcha's Starter plan is €9/month for 1,000 requests/month, with higher tiers as you scale. Cap is free at any volume — no per-request fee, no domain limit.
- **Server is open-source.** FriendlyCaptcha's framework integrations are open-source but the server is proprietary. Cap is fully Apache-2.0, end to end.
- **Self-hosted.** Cap runs on your own infrastructure, on a $5 VPS, with no third-party round-trip.
- **Two verification layers.** Cap adds [instrumentation challenges](../instrumentation.md) on top of proof-of-work. FriendlyCaptcha is PoW only.
- **No "vendor risk."** Open-source, self-hosted, Apache 2.0. No surprise pricing changes, no surprise shutdowns.

## Where they're similar

- Both use proof-of-work as the primary mechanism.
- Both are GDPR/CCPA-friendly by design.
- Both have clean, accessible widget UX with no image puzzles.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — proof-of-work + instrumentation
- [All alternatives](../alternatives.md) — full feature matrix
