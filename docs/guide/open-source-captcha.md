---
title: "Best Open-Source CAPTCHA Options in 2026"
description: "The best open-source, self-hosted CAPTCHA options for developers compared: Cap, ALTCHA, mCAPTCHA, and Anubis, with licensing, architecture, and how to choose."
faq:
  - q: What is the best open-source CAPTCHA?
    a: "Cap, if you want a complete stack: two verification layers, dashboard, compatible siteverify API. ALTCHA, if you want a minimal library."
  - q: Can I self-host CAPTCHA?
    a: "Yes, and it's easier than it sounds. Cap runs as one Docker container plus Valkey, fits on a $5 VPS, and takes about five minutes to set up."
  - q: Is Cap free?
    a: "Completely. Apache 2.0, no quotas, no paid tier, at any volume."
  - q: Is Cap better than ALTCHA?
    a: "Cap ships more (instrumentation layer, standalone server, dashboard, progress UX, smaller widget); ALTCHA ships less on purpose. Pick by how much you want to build yourself."
  - q: Does open-source CAPTCHA protect privacy?
    a: "It makes privacy auditable instead of promised. Self-hosted proof-of-work needs no fingerprinting, no behavioral profiling, and no third-party calls, and you can read the code to confirm it."
---

# Best Open-Source CAPTCHA Options in 2026

**Short answer:** Cap is a free, open-source, self-hosted CAPTCHA alternative licensed under Apache 2.0 that uses proof-of-work and [instrumentation challenges](./instrumentation.md) instead of visual puzzles. The other serious open-source options are **ALTCHA** (minimal PoW library), **mCAPTCHA** (PoW, pre-1.0 and slow-moving), and **Anubis** (PoW scraper wall for whole sites rather than forms).

## What makes a CAPTCHA open source?

A public widget repo on its own doesn't qualify. For bot protection, "open source" only means something when you can audit and run the parts that make decisions:

- **Client and server code published** under an OSI license, so the challenge logic isn't a black box.
- **Self-hostable verification**, so passing or failing a user never depends on a vendor's API being up, honest, or affordable.
- **No hidden phone-home**, which you can verify because you can read the code.

Several commercial CAPTCHAs open-source their client integrations while keeping the server proprietary (FriendlyCaptcha, for example). That's source-available convenience, not an open-source CAPTCHA: the decision engine is still a black box you rent.

## Why self-host CAPTCHA?

- **Privacy you can prove.** Visitor data never reaches a vendor, which makes GDPR/CCPA answers simple. See [Compliance](./compliance.md).
- **No quotas or per-request fees.** Traffic spikes and bot floods don't turn into invoices.
- **No vendor risk.** No surprise pricing changes, no deprecations, no acquisition rugs.
- **Control.** You set challenge difficulty per site key instead of trusting a remote model's verdict on your users.
- **Availability.** Your forms don't break when a third-party challenge endpoint has an outage.

## The options

### Cap

Cap is a full open-source CAPTCHA stack under Apache 2.0: a ~20 KB web-component widget plus [Cap Standalone](./standalone/index.md), a small Docker deployment (one container plus Valkey) exposing a REST API, a dashboard with multi-site-key management, and a `/siteverify` endpoint compatible with reCAPTCHA's API shape.

Protection comes from two independent layers: SHA-256 proof-of-work (with experimental GPU-resistant [RSW time-locks](./rsw.md)) and dynamic [instrumentation challenges](./instrumentation.md) that verify the environment is a real browser. Defeating one layer doesn't defeat the other.

If you'd rather embed than deploy, [capjs-core](./capjs-core.md) is Cap's stateless server library: it generates and verifies challenges inside your own service and runs on Cloudflare Workers, Lambda, and other edge environments with no persistent storage.

- **License:** Apache 2.0, client and server
- **Mechanism:** proof-of-work + instrumentation
- **Deployment:** Docker container + CDN or self-hosted widget
- **Best for:** teams that want a turn-key, self-hosted CAPTCHA service with real UX

### ALTCHA

ALTCHA is a minimal, well-maintained proof-of-work widget (MIT) you wire into your own backend. No dashboard, no standalone server in the open-source tier; the ML-based second layer is part of the paid Sentinel product.

- **License:** MIT (widget)
- **Mechanism:** proof-of-work
- **Best for:** developers who want a small library and are happy to build the server side themselves

[Full comparison: Cap vs ALTCHA →](./alternatives/altcha.md)

### mCAPTCHA

mCAPTCHA pioneered the same variable-difficulty PoW idea. It's fully open source (the core is AGPL-3.0; client libraries use permissive licenses), but it is still pre-1.0 with a slow release cadence, and its widget bundle is larger than Cap's or ALTCHA's. Fine to study, but weigh the maturity before building on it.

### Anubis

Anubis is an open-source proof-of-work *scraper wall*: it gates an entire site or path at the reverse-proxy level, mainly against AI crawlers. It's not a form CAPTCHA and doesn't ship a standalone verification server, but it pairs well with one. You can run Anubis in front of a site and Cap on the high-value forms inside it.

[Full comparison: Cap vs Anubis →](./alternatives/anubis.md)

## Side by side

| | Cap | ALTCHA | mCAPTCHA | Anubis |
| :-- | :-- | :-- | :-- | :-- |
| License | Apache 2.0 | MIT (widget) | AGPL | MIT |
| Actively maintained | ✅ | ✅ | 🟨 pre-1.0, slow releases | ✅ |
| Mechanism | PoW + instrumentation | PoW | PoW | PoW |
| Scope | Per-action (forms, APIs) | Per-action | Per-action | Whole-site gate |
| Standalone server + dashboard | ✅ | ❌ | ✅ | ❌ |
| reCAPTCHA-compatible siteverify | ✅ | ❌ | ❌ | ❌ |
| Widget size | ~20 KB | ~34 KB | larger | n/a (transparent) |
| GPU-resistant PoW option | ✅ [RSW](./rsw.md) | ❌ | ❌ | ❌ |

## How to choose

- **Want a service you deploy once and manage in a dashboard?** Cap. [Quickstart →](./index.md)
- **Want the smallest possible dependency and you'll own the backend glue?** Cap's [capjs-core](./capjs-core.md) library, or ALTCHA.
- **Fighting scrapers across a whole site, not form spam?** Anubis, optionally with Cap on the forms.
- **Migrating off reCAPTCHA or hCaptcha?** Cap's compatible siteverify makes it a URL swap. [Migration guide →](./alternatives/migrate-from-recaptcha.md)

## FAQ

### What is the best open-source CAPTCHA?

Cap, if you want a complete stack: two verification layers, dashboard, compatible siteverify API. ALTCHA, if you want a minimal library.

### Can I self-host CAPTCHA?

Yes, and it's easier than it sounds. Cap runs as one Docker container plus Valkey, fits on a $5 VPS, and takes about five minutes to set up.

### Is Cap free?

Completely. Apache 2.0, no quotas, no paid tier, at any volume.

### Is Cap better than ALTCHA?

Cap ships more (instrumentation layer, standalone server, dashboard, progress UX, smaller widget); ALTCHA ships less on purpose. Pick by how much you want to build yourself.

### Does open-source CAPTCHA protect privacy?

It makes privacy auditable instead of promised. Self-hosted PoW needs no fingerprinting, no behavioral profiling, and no third-party calls, and you can read the code to confirm it.

## See also

- [Best CAPTCHA alternatives in 2026](./best-captcha-alternatives.md): including the closed-source field
- [Feature comparison](./alternatives.md): the full matrix
- [How does Cap work?](./workings.md): the architecture in detail
- [Live demo](./demo.md): try the widget
