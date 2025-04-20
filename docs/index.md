---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Cap"
  text: "A modern, lightning-quick PoW captcha"
  tagline: "Cap is a lightweight, modern open-source CAPTCHA alternative using SHA-256 proof-of-work"
  image:
    src: /logo.png
    alt: VitePress
  actions:
    - theme: brand
      text: Quickstart & docs
      link: /guide
    - theme: alt
      text: Demo
      link: https://cap-starter.glitch.me/
    - theme: alt
      text: GitHub
      link: https://github.com/tiagorangel1/cap

features:
  - icon: ⚡️
    title: 250x smaller than hCaptcha
    details: Cap's widget library is extremely small, only 12kb minified and brotli'd.
  - icon: 🔒️
    title: Private
    details: Cap's usage of proof-of-work eliminates the need for any tracking, fingerprinting or data collection.
  - icon: 🌈
    title: Fully customizable
    details: Cap is self-hostable so you can customize both the backend & frontend — or you can just use CSS variables
  - icon: 🤖
    title: PoW-based
    details: Cap uses proof-of-work instead of complex puzzles, making it easier for humans and harder for bots
  - icon: 🧩
    title: Standalone mode
    details: Cap offers a standalone mode with Docker, allowing you to use it with languages other than JS.
  - icon: 💨
    title: Invisible mode
    details: Cap can run invisibly in the background using a simple JS API.
  - icon: ☁️
    title: Floating mode
    details: Floating mode keeps your CAPTCHA hidden until it's needed
  - icon: 🌳
    title: Fully FOSS
    details: Completely open source under the Apache license 2.0 license
---

## What is Cap?

Cap is a lightweight, open-source CAPTCHA alternative that uses SHA-256-based proof-of-work to verify real users and block bots — no cookies, no trackers.

- ✅ Privacy-friendly
- ⚡ Fast and lightweight
- 🔓 Fully open source (Apache 2.0)
- 🧩 Pluggable widget + solver + backend

It's ideal for:

- Protecting APIs from bots
- Preventing spam on forms
- Blocking automated login attempts
- Securing free-tier abuse

Cap is built with JavaScript, runs on any JS runtime (Bun, Node.js, Deno), and has no dependencies. If you're not using any JS runtime, you can also use the standalone mode with Docker, which relies entirely on a simple REST API to create and validate challenges.

Zero dependencies, developer-friendly, and effective against spam, DDoS, and automation.

## Alternatives

Cap.js is a modern alternative to:

- [reCAPTCHA](https://www.google.com/recaptcha/about/)
- [hCaptcha](https://www.hcaptcha.com/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

But unlike them, Cap is **computation-bound, not tracking-bound**.