---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Cap"
  text: "A modern, lightning-quick PoW captcha"
  tagline: "Cap is a lightweight, modern open-source CAPTCHA alternative designed using SHA-256 proof-of-work"
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
    details: Completely open source under AGPL-3.0, with no premium versions.
---
