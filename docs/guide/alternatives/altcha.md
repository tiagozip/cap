---
title: Cap vs Altcha
description: How Cap compares to Altcha. Both are open-source proof-of-work CAPTCHAs — here's where they differ.
---

# Cap vs Altcha

Altcha is the closest project in spirit to Cap: open-source, proof-of-work, no fingerprinting, no third-party dependency. Both are good choices. The differences come down to features and operational shape.

Altcha also has a commercial product called **Altcha Sentinel** that layers ML-based threat detection on top of the open-source widget. The comparison below is mostly between Cap and the open-source Altcha widget; if you're considering Sentinel, you're comparing a paid SaaS to a self-hosted OSS project, which is a different decision.

## Quick verdict

If you want a minimal, library-style PoW CAPTCHA you can drop into a Node project and forget about, the open-source Altcha is great. If you want a turn-key self-hosted service with a dashboard, multi-site-key support, instrumentation challenges layered on top of PoW, and a UI that progress-tracks the solve — without paying for Sentinel — Cap is the better fit.

## Where Altcha makes sense

- You want a tiny, library-only integration with no separate service to run.
- You don't need a second verification layer beyond proof-of-work, or you're willing to pay for Sentinel to get ML-based detection.
- You're already integrated with Altcha and the migration cost outweighs the differences below.

## Where Cap is the better choice

- **Two independent verification layers, free.** Cap runs proof-of-work *and* dynamic JavaScript [instrumentation challenges](../instrumentation.md) in parallel, both included. Defeating one doesn't defeat the other. The open-source Altcha is PoW only; the second layer (ML-based) requires paying for Sentinel.
- **Standalone server with dashboard, free.** Cap ships a one-Docker-container deployment with a web dashboard, multi-site-key management, analytics, and a reCAPTCHA-compatible siteverify endpoint. Altcha's open-source side leaves you to wire those yourself; the all-in-one experience is Sentinel-only.
- **Smaller widget.** Cap is ~20 KB. Altcha is ~34 KB gzipped.
- **Progress tracking.** Cap's widget reports solve progress to the user as a percentage — meaningful UX feedback during the small wait.
- **Floating and programmatic modes.** Cap can hide entirely or float over a button until form submit. Altcha's display modes are simpler.
- **Customizable look.** Cap exposes CSS variables for colors, size, position, and icons. Altcha's customization is more limited.

## Where they're similar

- Both are open-source (Cap is Apache-2.0, Altcha's widget is MIT) with no telemetry.
- Both run client-side proof-of-work to make abuse expensive.
- Both work without any third-party network round-trip when self-hosted.
- Both are GDPR/CCPA-friendly by design.

## See also

- [Live demo](../demo.md) — try Cap in your browser
- [How Cap detects bots](../effectiveness.md) — proof-of-work + instrumentation
- [All alternatives](../alternatives.md) — full feature matrix
