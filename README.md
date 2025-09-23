# <img src="https://github.com/tiagozip/cap/blob/main/docs/public/logo-small.webp?raw=true" alt="" align="left" width="40" height="40"> &nbsp;Cap

Cap is a lightweight, modern open-source CAPTCHA alternative using <a href="https://capjs.js.org/guide/effectiveness.html">SHA-256 proof-of-work</a>. It's fast, private, and extremely simple to integrate.

## Documentation

[Read the Cap docs](https://capjs.js.org), try the [demo](https://capjs.js.org/guide/demo.html) or read the [feature comparison](https://capjs.js.org/guide/alternatives.html)

## What is Cap?

Cap is the modern, open-source alternative to traditional CAPTCHAs that uses proof-of-work instead of annoying visual puzzles.

It's built with JavaScript and Rust and has no dependencies. You can either run it on any JavaScript runtime (Bun, Node.js, Deno), or use the standalone mode with Docker.

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

Cap is a great alternative to [reCAPTCHA](https://www.google.com/recaptcha/about/), [hCaptcha](https://www.hcaptcha.com/) and [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## License

Apache 2.0

Copyright (c) 2025–present tiago

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9920/badge)](https://www.bestpractices.dev/projects/9920) [![Product Hunt: #1 of the month: User Experience](https://img.shields.io/badge/%231%20of%20the%20month-orange?logo=producthunt&logoColor=white)](https://www.producthunt.com/posts/cap-5?embed=true&utm_source=badge-top-post-topic-badge&utm_medium=badge&utm_souce=badge-cap-5) 