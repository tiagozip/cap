---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Cap"
  text: "Self-hosted CAPTCHA for the modern web."
  tagline: "Lightweight, privacy-first, and designed to put you first. Switch from reCAPTCHA in minutes."
  image:
    src: /logo.png
    alt: VitePress
  actions:
    - theme: brand
      text: Get started →
      link: /guide
    - theme: alt
      text: Demo
      link: /guide/demo.md
    - theme: alt
      text: View on GitHub
      link: https://github.com/tiagozip/cap

features:
  - icon: ⚡️
    title: 250x smaller than hCaptcha
    details: ~20kb, zero dependencies, loads in milliseconds
  - icon: 🔒️
    title: Privacy-first
    details: Cap doesn't send any telemetry back to our servers
  - icon: 🌈
    title: Fully customizable
    details: Change the colors, size, position, icons and more with CSS variables
  - icon: 💽
    title: Proof-of-work
    details: Your users no longer have to waste time solving visual puzzles.
  - icon: 🐳
    title: Standalone mode
    details: Run Cap anywhere with a Docker container with analytics & more
  - icon: 💨
    title: Invisible
    details: Hide Cap's widget and solve challenges in the background
  - icon: 🤖
    title: M2M
    details: Keep your APIs protected while accessible to friendly robots
  - icon: 🌳
    title: Open-source
    details: Completely free & open-source under the Apache 2.0 license
---

## What is Cap?

Cap is the modern, self-hosted alternative to traditional CAPTCHAs that uses proof-of-work instead of annoying visual puzzles.

Cap is built with JavaScript and Rust and both the widget and server helper have zero dependencies.

You can either run it on any JavaScript runtime, or use the standalone mode with Docker.

---

Cap is built into 2 main parts. The [widget](https://capjs.js.org/guide/widget.html) is a small client-side JavaScript library using custom components and WASM that renders the CAPTCHA and solves the challenge.

The [Standalone Server](https://capjs.js.org/guide/standalone.html) is a Docker image that helps you use Cap with any language or framework. As an alternative, if your server-side uses JavaScript, you can use the lighter [server](https://capjs.js.org/guide/server.html) library.

Cap also has a [M2M library](https://capjs.js.org/guide/solver.html) that implements a custom proof-of-work solver for protecting API endpoints that you still want public.

## Why Cap?

- **250x smaller than hCaptcha**  
  ~20kb, zero dependencies, loads in milliseconds
- **Privacy-first**  
   Cap doesn't send any telemetry back to our servers
- **Fully customizable**  
   Change the colors, size, position, icons and more with CSS variables
- **Proof-of-work**  
   Your users no longer have to waste time solving visual puzzles.
- **Standalone mode**  
   Run Cap anywhere with a Docker container with analytics & more
- **Invisible**  
   Hide Cap's widget and solve challenges in the background
- **M2M**  
   Keep your APIs protected while accessible to friendly robots
- **Open-source**  
   Completely free & open-source under the Apache 2.0 license

It's ideal for protecting APIs from bots, preventing spam on forms, blocking automated signup attempts and securing free-tier abuse.

Cap is a great alternative to [reCAPTCHA](https://www.google.com/recaptcha/about/), [hCaptcha](https://www.hcaptcha.com/) and [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/). Check out the [feature comparison](https://capjs.js.org/guide/alternatives.html) to see how Cap compares to other CAPTCHAs.

## License

This project is licensed under the Apache-2.0 License, please see the [LICENSE](https://github.com/tiagozip/cap/blob/main/LICENSE) file for details.

Copyright ©2025 - present [tiago](https://tiago.zip)

---

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9920/badge)](https://www.bestpractices.dev/projects/9920) [![Product Hunt: #1 of the month: User Experience](https://img.shields.io/badge/%231%20of%20the%20month-orange?logo=producthunt&logoColor=white)](https://www.producthunt.com/posts/cap-5?embed=true&utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-cap-5)
