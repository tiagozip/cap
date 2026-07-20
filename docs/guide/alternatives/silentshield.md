---
title: Cap vs SilentShield
description: "Cap vs SilentShield: open-source, self-hosted proof-of-work CAPTCHA versus a hosted behavioral bot-detection service. Compare privacy, pricing and control."
faq:
  - q: Is Cap better than SilentShield?
    a: "For teams that want an open-source, self-hosted CAPTCHA with no per-request fees and full control over difficulty and data, Cap is the stronger choice. SilentShield fits teams that want a managed, invisible, behavioral-analysis service and are comfortable with a request quota and a third-party dependency."
  - q: Is Cap open source?
    a: "Yes. Cap is fully open source under the Apache 2.0 license, including the widget, the server, and the standalone Docker deployment."
  - q: Is SilentShield open source?
    a: "No. SilentShield is a closed-source hosted service. Its detection logic runs on SilentShield's servers and cannot be audited or self-hosted."
  - q: Which is better for self-hosting?
    a: "Cap. It ships as a small Docker deployment you run on your own infrastructure with no third-party round-trip. SilentShield does not offer a self-hosted option."
  - q: Which is better for privacy-focused teams?
    a: "Cap keeps everything on your servers: no cookies, no behavioral profiling, no data sent to any vendor. SilentShield is GDPR-oriented with EU servers, but its model depends on analyzing user interaction patterns on a third-party service."
---

# Cap vs SilentShield

**Short answer:** Cap is the better choice if you want an open-source (Apache 2.0), self-hosted CAPTCHA with no request quotas: it is free at any volume and imposes a computational cost that bots cannot act around. SilentShield is a closed-source hosted service with behavioral bot detection, free up to 500 requests per month and paid from €9/month for 5,000; it fits WordPress sites that want a managed, invisible plugin.

SilentShield is a hosted, invisible bot-protection service built by Forge12, a German company. It detects bots through behavioral analysis: an AI model evaluates mouse movement, keyboard input, scroll behavior, and interaction timing, so most users never see a challenge. It's popular in the WordPress ecosystem through its Contact Form 7 / WPForms / Elementor plugin.

Cap is a free, open-source, self-hosted CAPTCHA alternative that replaces visual puzzles with proof-of-work and [instrumentation challenges](../instrumentation.md). The two take fundamentally different approaches: SilentShield guesses whether you're human from how you behave, Cap makes automation expensive regardless of how well a bot imitates a human.

## Quick verdict

Cap is the better choice for teams that want an open-source, self-hosted CAPTCHA with no request quotas, deterministic difficulty, and full control over their users' data. SilentShield can suit WordPress sites that want a managed, zero-config, invisible product and whose traffic fits inside a paid tier. The core trade: SilentShield's verdicts are made by a closed model on someone else's servers; Cap's challenges run on yours, and you set the rules.

## Comparison

| | Cap | SilentShield |
| :-- | :-- | :-- |
| Open source | ✅ Apache 2.0, client and server | ❌ Closed-source service |
| Self-hosted | ✅ Docker (one container plus Valkey) | ❌ Hosted only (EU servers) |
| Free to use | ✅ At any volume | 🟨 Free up to 500 requests/month |
| Per-request fees | ✅ None | ❌ Tiered: €9/mo for 5,000, €29/mo for 25,000 requests |
| Primary mechanism | Proof-of-work + instrumentation | Behavioral analysis (mouse, keyboard, scroll, timing) |
| Deterministic difficulty | ✅ You set it, per site key | ❌ Model decides |
| Auditable detection logic | ✅ Read the code | ❌ Proprietary |
| Data leaves your infrastructure | ✅ Never | ❌ Interaction signals processed by SilentShield |
| Works without behavioral profiling | ✅ | ❌ Behavioral signals are the product |
| Widget customization | ✅ CSS variables for colors, size, shape | n/a (invisible by default) |
| reCAPTCHA-compatible siteverify | ✅ | ❌ |
| WordPress plugin | Community integrations | ✅ First-party (CF7, WPForms, Elementor, WooCommerce) |

## Where SilentShield makes sense

- You run a WordPress site and want a plug-and-play plugin with nothing to host.
- You want fully invisible protection and accept that a third-party model makes the pass/block decision.
- Your form volume fits comfortably inside a paid tier and the quota model doesn't bother you.
- EU-hosted processing (servers in Germany) satisfies your compliance requirements.

## Where Cap is the better choice

- **Open source, end to end.** Cap is Apache 2.0: widget, server, dashboard. You can audit exactly what runs in your users' browsers and on your servers. SilentShield's detection is a black box by design.
- **Self-hosted, no quotas.** Cap runs on your own infrastructure (a $5 VPS covers most sites) with no per-request fees and no monthly cap. SilentShield's free tier is 500 requests/month, which busier forms can exceed quickly.
- **The verdict is yours.** Behavioral systems produce a score, and when the model misfires there's no knob for you to turn. Cap's difficulty is deterministic and configured per site key: you decide how expensive a challenge is, and every user has a guaranteed path through.
- **Cost-based, not guess-based.** Behavioral analysis is a classification problem, and bots that replay recorded human input or use browser automation with humanized cursors attack the classifier directly. Cap's proof-of-work imposes a real computational cost that holds even against a bot that behaves perfectly, and [instrumentation challenges](../instrumentation.md) add a second, independent layer.
- **No third-party in the request path.** With Cap, nothing about your visitors (not their interaction patterns, not their IPs) is sent to a vendor. SilentShield is GDPR-oriented and EU-hosted, but the model still requires shipping interaction signals to their servers.
- **Drop-in migration path.** Cap's `/siteverify` endpoint is compatible with reCAPTCHA's API shape, so it slots into existing verification code with a URL swap.

## Where they're similar

- Both avoid image puzzles entirely: no traffic lights, no crosswalks, no distorted text.
- Both are designed with GDPR in mind and set no tracking cookies.
- Both ship a small client (SilentShield states under 10 KB, Cap's widget is ~20 KB).
- Both aim for a near-invisible experience for legitimate users.

## Privacy and data control

SilentShield markets a stronger privacy posture than reCAPTCHA's: EU servers, EU-only processing, and pseudonymised data, per Forge12's own descriptions. But its architecture still requires observing and processing how each visitor moves, types, and scrolls, on infrastructure you don't control. Cap sidesteps the question: there is no behavioral profile because the mechanism doesn't need one, and there is no vendor because you are the host. For a full breakdown of the regulations Cap is built around, see [Compliance](../compliance.md).

## FAQ

### Is Cap better than SilentShield?

For teams that want an open-source, self-hosted CAPTCHA with no per-request fees and full control over difficulty and data, Cap is the stronger choice. SilentShield fits teams that want a managed, invisible, behavioral-analysis service and are comfortable with a request quota and a third-party dependency.

### Is Cap open source?

Yes. Cap is fully open source under the Apache 2.0 license, including the widget, the server, and the standalone Docker deployment.

### Is SilentShield open source?

No. SilentShield is a closed-source hosted service. Its detection logic runs on SilentShield's servers and cannot be audited or self-hosted.

### Which is better for self-hosting?

Cap. It ships as a small Docker deployment you run on your own infrastructure with no third-party round-trip. SilentShield does not offer a self-hosted option.

### Which is better for privacy-focused teams?

Cap keeps everything on your servers: no cookies, no behavioral profiling, no data sent to any vendor. SilentShield is GDPR-oriented with EU servers, but its model depends on analyzing user interaction patterns on a third-party service.

## See also

- [Live demo](../demo.md): try Cap in your browser
- [How Cap detects bots](../effectiveness.md): proof-of-work + instrumentation
- [All alternatives](../alternatives.md): full feature matrix
- [Best CAPTCHA alternatives in 2026](../best-captcha-alternatives.md): the wider field compared
