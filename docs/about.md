---
title: About Cap
description: "Who builds Cap, the open-source, self-hosted CAPTCHA alternative: its maintainer, history, license, funding, and how to get in touch."
sidebar: false
---

# About Cap

**TL;DR:** Cap is a free, open-source CAPTCHA alternative that replaces visual puzzles with proof-of-work and instrumentation challenges. It's licensed under Apache 2.0 and runs entirely on your own infrastructure, so visitor data never reaches a third party.

## What is Cap?

Cap is bot protection you can read, audit, and self-host:

- A **~20 KB widget** that renders a single checkbox instead of image puzzles.
- A **standalone server** that ships as one Docker container with a dashboard and multi-site-key support.
- **Server libraries** (`@cap.js/server` and community ports) for verifying challenges in your own backend.
- A **siteverify API compatible with reCAPTCHA and hCaptcha**, so migrating is mostly a URL swap.

The full source lives at [github.com/tiagozip/cap](https://github.com/tiagozip/cap) under the [Apache 2.0 license](https://www.apache.org/licenses/LICENSE-2.0).

## Why does Cap exist?

Mainstream CAPTCHAs either interrogate users with puzzles or profile them with fingerprinting and risk scores, and both approaches route your visitors' data through a vendor. Cap takes a different position:

- **Deterministic, not judgmental.** Every real user has a guaranteed path through; no classifier can silently reject someone for using a VPN or a privacy browser.
- **Self-hosted, not rented.** Verification happens on your servers, which makes GDPR and CCPA answers simple. See [Compliance](./guide/compliance.md).
- **Open, not promised.** Privacy claims are auditable because the code that makes decisions is public.

## Get in touch

- Bugs and feature requests: [GitHub issues](https://github.com/tiagozip/cap/issues)
- Security reports and everything else: [hi@tiago.zip](mailto:hi@tiago.zip)
