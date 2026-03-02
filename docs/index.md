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
    title: Programmatic
    details: Hide Cap's widget and solve challenges in the background
  - icon: 🤖
    title: M2M
    details: Keep your APIs protected while accessible to friendly robots
  - icon: 🌳
    title: Open-source
    details: Completely free & open-source under the Apache 2.0 license
---
