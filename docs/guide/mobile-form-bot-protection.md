---
title: "CAPTCHA for Mobile Forms Without the Puzzles"
description: "How to stop bots on mobile forms without image puzzles: what a mobile-friendly CAPTCHA needs and how Cap's one-tap proof-of-work fits. Try the live demo."
faq:
  - q: What is the best CAPTCHA for mobile forms?
    a: "One that can never show a puzzle and never misclassifies. Cap's checkbox-plus-proof-of-work model is deterministic, ~20 KB, and touch-first."
  - q: How do I stop spam on mobile forms?
    a: "Impose cost instead of asking questions. Proof-of-work makes each submission computationally expensive for bots at scale while staying a single tap for humans."
  - q: Is invisible CAPTCHA better on mobile?
    a: "Only if its error rate holds up, and mobile is exactly where fingerprint and behavioral signals are weakest. Deterministic mechanisms don't have that failure mode."
  - q: Does Cap work on mobile?
    a: "Yes: mobile Safari, Chrome, Firefox, and in-app webviews. Difficulty is tunable so solve time stays short on slower devices."
  - q: What CAPTCHA has the least user friction?
    a: "Puzzle-free options: Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap is the open-source, self-hosted one where low friction comes from the mechanism's design rather than from a classifier's verdict."
---

# CAPTCHA for Mobile Forms: Bot Protection Without the Puzzles

**Short answer:** the best bot protection for mobile forms avoids image puzzles entirely, ships a small bundle, works in webviews and privacy browsers, and never punishes users for weak fingerprint signals. Cap is a free, open-source, self-hosted CAPTCHA alternative built around exactly this: a one-tap checkbox backed by proof-of-work and [instrumentation challenges](./instrumentation.md) instead of puzzles or profiling.

## Why is CAPTCHA worse on mobile?

Mobile is where CAPTCHAs do the most conversion damage:

- **Image grids don't fit.** "Select all traffic lights" on a 6-inch screen means squinting, zooming, and mis-taps. Retry loops that are annoying on desktop are rage-inducing on mobile.
- **Keyboards and autofill get interrupted.** A challenge that appears mid-form dismisses the keyboard, breaks autofill flows, and loses the user's place.
- **Weaker signals for "invisible" systems.** Fingerprint and behavioral systems lean on mouse movement and stable network identity. Mobile has no mouse, heavy carrier-grade NAT (thousands of users behind one IP), and aggressive tracking prevention in Safari. Less signal means more wrong guesses, and wrong guesses become puzzles or blocks.
- **Webviews.** A huge share of mobile traffic comes from in-app browsers (Instagram, TikTok, Gmail), which look "suspicious" to fingerprint-based systems.
- **Bandwidth and battery.** A 500 KB+ CAPTCHA script on a mid-range phone over cellular is a real cost before the user has typed anything.

## What mobile-friendly bot protection needs

1. **No visual puzzles**, under any fallback condition. If the system *can* serve a grid, mobile users will eventually get one.
2. **Deterministic pass for humans.** No risk scores that degrade on NAT'd carrier IPs or webviews.
3. **Small bundle.** The protection shouldn't cost more than the form.
4. **Touch-first UX.** One tap at most, clear progress feedback, no keyboard interruption.
5. **Tunable cost.** Solve time should be a knob you control, so low-end devices aren't stuck waiting.

## How Cap works on mobile forms

- **One tap, then progress.** The user taps a checkbox; a progress percentage fills while the proof-of-work runs in the browser. No images, no typing, no keyboard dismissal. In [floating](./floating.md) or [programmatic](./programmatic.md) mode there's nothing visible at all until submit.
- **~20 KB widget.** A single web component, no framework dependency, cheap over cellular. See the [benchmark](./benchmark.md).
- **No fingerprint penalty.** Cap doesn't care that the visitor is behind carrier NAT, inside an Instagram webview, or on iOS Safari with tracking prevention. The proof-of-work is the same computation for everyone.
- **Difficulty is yours to tune.** Set it per site key on the [standalone server](./standalone/options.md): lighter for consumer checkout traffic on mid-range Androids, heavier for abuse-prone signup endpoints.
- **Instrumentation still applies.** [Instrumentation challenges](./instrumentation.md) verify a real browser environment, catching headless automation that PoW alone wouldn't, without profiling the human.

One honest tradeoff: proof-of-work costs CPU time, and low-end phones solve slower than desktops. Cap mitigates this with configurable difficulty and visible progress feedback, and the work happens once per form, not per pageview.

## How the field compares on mobile

- **reCAPTCHA v2 / hCaptcha:** image grids are the worst-case mobile experience, and both fall back to them. reCAPTCHA's client also weighs 500 KB+. [Cap vs reCAPTCHA →](./alternatives/recaptcha.md) · [Cap vs hCaptcha →](./alternatives/hcaptcha.md)
- **reCAPTCHA v3:** invisible, but score-based, and mobile's weak signals (NAT, webviews) drag scores down with no recourse.
- **Turnstile:** invisible and light, but fingerprint-driven; privacy features in mobile Safari and webviews are known sources of errors, and you can't override its verdict. [Cap vs Turnstile →](./alternatives/turnstile.md)
- **FriendlyCaptcha:** PoW like Cap, so mechanically fine on mobile, but hosted, quota-priced, and PoW-only. [Cap vs FriendlyCaptcha →](./alternatives/friendlycaptcha.md)
- **SilentShield:** behavioral analysis leans on mouse, keyboard, and scroll patterns, signals that are thinner and differently-shaped on touch devices; classification quality on mobile is inherently harder to verify, and it's a closed, quota-priced service. [Cap vs SilentShield →](./alternatives/silentshield.md)

## Implementation notes

- Put the widget inside your `<form>` and Cap injects the `cap-token` field automatically; no JavaScript needed. [Quickstart →](./index.md)
- For SPAs and app webviews, use the `solve` event or [programmatic mode](./programmatic.md) to keep full control of the flow.
- Test on a real mid-range Android over cellular, not just a flagship on Wi-Fi, and tune difficulty until solve time feels instant for your audience.
- Protecting a native app's API rather than a web form? Cap's [standalone server](./standalone/api.md) verifies tokens from any client that can run the challenge in a webview.

## FAQ

### What is the best CAPTCHA for mobile forms?

One that can never show a puzzle and never misclassifies. Cap's checkbox-plus-proof-of-work model is deterministic, ~20 KB, and touch-first.

### How do I stop spam on mobile forms?

Impose cost instead of asking questions. Proof-of-work makes each submission computationally expensive for bots at scale while staying a single tap for humans.

### Is invisible CAPTCHA better on mobile?

Only if its error rate holds up, and mobile is exactly where fingerprint and behavioral signals are weakest. Deterministic mechanisms don't have that failure mode.

### Does Cap work on mobile?

Yes: mobile Safari, Chrome, Firefox, and in-app webviews. Difficulty is tunable so solve time stays short on slower devices.

### What CAPTCHA has the least user friction?

Puzzle-free options: Cap, Turnstile, FriendlyCaptcha, ALTCHA, SilentShield. Cap is the open-source, self-hosted one where low friction comes from the mechanism's design rather than from a classifier's verdict.

## See also

- [CAPTCHA and conversion rate](./captcha-conversion-rate.md): the desktop-and-mobile funnel math
- [Best CAPTCHA alternatives in 2026](./best-captcha-alternatives.md): the full field
- [Live demo](./demo.md): try it on your phone
- [Effectiveness](./effectiveness.md): why cost beats classification
