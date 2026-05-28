---
title: Migrating from reCAPTCHA to Cap
description: "Google is moving reCAPTCHA into Google Cloud and auto-migrating Classic keys. Migrate to Cap instead: a faster, private, self-hosted, open-source CAPTCHA with a reCAPTCHA-compatible siteverify API and Turnstile-tier bot detection."
---

# Migrating from reCAPTCHA to Cap

Google is moving reCAPTCHA into Google Cloud and auto-migrating Classic keys onto billed projects. So you have to touch your integration regardless. The good news: this is the perfect excuse to leave Google's tracking-based CAPTCHA behind for something faster, private, and free.

Cap is a drop-in replacement for the part that matters, and an upgrade for almost everything else.

## Why teams switch to Cap

- **Turnstile-tier detection, without the third party.** Cap pairs proof-of-work with instrumentation challenges, the same browser-verification technique YouTube and Twitter/X run at massive scale. It sits in the same detection tier as Cloudflare Turnstile while staying fully self-hosted.
- **Proven at scale.** Around **1 billion challenges solved in Q1 2026 alone** (per JSDelivr), and trusted in production by teams like **AdGuard** and **Bunny.net**. This is not an experiment.
- **A fraction of the weight, and invisible.** Cap's widget is roughly 21 KB gzipped versus reCAPTCHA's 200 to 600 KB client, often a 10x or more reduction. Default challenges solve in 2 to 3 seconds in the background, with no traffic-light puzzles and nothing for the user to click through.
- **Genuinely free, no metering.** No Google Cloud project, no billing account, no per-assessment fee. One Docker container and a Valkey instance run most workloads on a $5 VPS.
- **Private by default.** reCAPTCHA loads scripts from `google.com` and ships user signals to Google. Cap sends data nowhere. Nothing third-party touches your page.
- **You hold the controls.** reCAPTCHA v3 silently penalizes users on VPNs, Tor, and privacy browsers with no recourse. With Cap you set the difficulty, and every real user always has a path through.
- **Open source, forever.** Apache 2.0. Audit it, fork it, deploy it. No vendor can change the terms on you.

For the full breakdown, see [Cap vs reCAPTCHA](./recaptcha.md).

## What's changing with reCAPTCHA

If you need the context for why the migration emails are landing now:

- New keys can no longer be created in the legacy reCAPTCHA admin console.
- Existing reCAPTCHA Classic keys are being migrated automatically into Google Cloud projects, a process Google ran through late 2025 and into 2026.
- Once migrated, a key's API access is tied to a Google Cloud project. Past the free tier of 10,000 assessments per month, you have to enable billing on that project.

Keeping reCAPTCHA now means a Google Cloud project, a billing account on file, and metered assessments. Moving to Cap means none of that, on a timeline you control.

## How the migration works

Cap's `/siteverify` endpoint mirrors reCAPTCHA's request shape on purpose, so the server side is close to a drop-in. The widget swap is tag-for-tag. Three steps, and you can run both in parallel during the cut-over.

### 1. Stand up a Cap instance

Follow the [quickstart](../index.md) to run Cap Standalone with Docker. Create a site key in the dashboard and note both the **site key** and its **secret key**. Keep [instrumentation challenges](../instrumentation.md) on (the default) for the strongest bot protection.

### 2. Swap the client widget

Replace the reCAPTCHA script and element with Cap's widget.

Before:

```html
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="<your-recaptcha-site-key>"></div>
```

After:

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
```

If your reCAPTCHA widget lived inside a `<form>`, the token handling carries over: reCAPTCHA auto-injected a `g-recaptcha-response` field, and Cap auto-injects a `cap-token` field on submit. Outside a form, listen for the `solve` event:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

### 3. Swap the server verification

reCAPTCHA verification posts `secret` and `response` to a fixed Google URL. Cap takes the same two parameters, posted to your own instance:

Before:

```js
const { success } = await (
  await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: token }),
  })
).json();
```

After:

```js
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: CAP_SECRET, response: token }),
  })
).json();
```

The token your server reads also changes name: pull `cap-token` from the submitted form (or the value you captured from the `solve` event) instead of `g-recaptcha-response`.

## What's compatible, and what isn't

We'd rather you migrate with eyes open than hit a surprise in production. The compatibility is real, but not byte-for-byte:

| | reCAPTCHA | Cap |
| --- | --- | --- |
| Request params | `secret`, `response`, optional `remoteip` | `secret`, `response` (`remoteip` is ignored) |
| Endpoint | fixed `google.com` URL | your own `/<site-key>/siteverify` |
| Success field | `success` (boolean) | `success` (boolean) |
| Error reporting | `error-codes` (array) | `error` (string) |
| Extra fields | `challenge_ts`, `hostname`, `score` (v3) | none |

In practice:

- Code that only checks `response.success` works after a URL and secret swap. That's the common case, and it's a one-line change.
- Code that inspects `error-codes`, `challenge_ts`, `hostname`, or the v3 `score` needs updating. Cap is a verification system, not a behavioral risk score, so those fields don't exist.
- If you use a backend SDK that hardcodes Google's verify URL, swap it for one that lets you set the endpoint, or call `/siteverify` directly. It's two parameters.

## Migrate with zero downtime

You never have to flip a switch and pray. Mount Cap on a separate element and have your backend accept either a valid `cap-token` or a valid `g-recaptcha-response` during the transition. Watch Cap's verification rate in your logs, and once it looks healthy, delete the reCAPTCHA script, element, and server call. Most teams finish the cut-over in an afternoon.

## See also

- [Live demo](../demo.md) — solve a Cap challenge yourself, then time it against reCAPTCHA
- [Cap vs reCAPTCHA](./recaptcha.md) — the full comparison
- [How Cap detects bots](../effectiveness.md) — the proof-of-work + instrumentation model
- [Quickstart](../index.md) — stand up Cap from scratch in five minutes
