# <img src="https://github.com/tiagozip/cap/blob/main/docs/public/logo-small.webp?raw=true" alt="" align="left" width="40" height="40"> Priestess Verification

Priestess Verification is a fork of [Cap](https://github.com/tiagozip/cap) by Tiago, licensed under Apache-2.0. Modified by Rakko (KurisuRakko): renamed the user-facing branding.

Priestess Verification is a lightweight, modern open-source CAPTCHA alternative using <a href="https://trycap.dev/guide/effectiveness?utm_source=github&utm_campaign=pow_link" target="_blank">proof-of-work</a> and <a href="https://trycap.dev/guide/instrumentation?utm_source=github&utm_campaign=inst_link" target="_blank">instrumentation challenges</a>. It's fast, private, and extremely simple to integrate.

<a href="https://trycap.dev/guide/demo?utm_source=github&utm_campaign=captcha_animated" target="_blank"><img src="./assets/captcha-animated.svg" alt="Priestess Verification widget" width="270"></a>

## Using the widget

The fork distributes the widget through jsDelivr's GitHub channel (there is no npm package):

```html
<!-- pin to a release tag in production, e.g. @v1.0.0 -->
<script src="https://cdn.jsdelivr.net/gh/KurisuRakko/priestess-verification@main/widget/src/cap.min.js"></script>

<cap-widget data-cap-api-endpoint="https://your-cap-server.example/your-site-key/"></cap-widget>
```

`@main` is cached at jsDelivr's edge for up to 12 hours, so a push to this fork can take that long to reach users. In production, pin the widget to a release tag instead (e.g. `@v1.0.0`, created at release time) or to a commit sha.

Floating mode loads `cap-floating.min.js` from the same directory. The element name, attributes and JavaScript API stay compatible with upstream Cap, so the [upstream documentation](https://trycap.dev) still applies.

Note: `widget/src/cap.compat.min.js` is upstream's legacy compatibility bundle. It still contains the upstream branding and has not been rebuilt.

## Documentation

**[Read the docs](https://trycap.dev/?utm_source=github&utm_campaign=read_docs)**, try the [demo](https://trycap.dev/guide/demo.html?utm_source=github&utm_campaign=demo_link)

The documentation site belongs to the upstream project and has not been migrated to this fork: its examples still load the widget from the npm package `@cap.js/widget`. In this fork, load the widget from jsDelivr as shown in [Using the widget](#using-the-widget), and set `WIDGET_VERSION` to a git tag or commit of this fork.

## What is Priestess Verification?

Priestess Verification replaces visual captchas with modern, accessible and privacy-preserving challenges. No images, no tracking, no dependencies, works everywhere.

The default way to use Priestess Verification is with the Standalone Docker container. [Learn more about how Priestess Verification works](https://trycap.dev/guide/?utm_source=github&utm_campaign=learn_more)

## Why Priestess Verification?

- **250x smaller than hCaptcha**  
  ~20kb, zero dependencies, loads in milliseconds

- **Privacy-first**  
   Priestess Verification doesn't send any telemetry back to our servers

- **Fully customizable**  
   Change the colors, size, position, icons and more with CSS variables

- **Proof-of-work**  
   Your users no longer have to waste time solving visual puzzles.

- **Standalone mode**  
   Run Priestess Verification anywhere with a Docker container with analytics & more

- **No user interaction needed**  
   Hide Priestess Verification's widget and solve challenges in the background

- **Open-source**  
   Completely free & open-source under the Apache 2.0 license

Priestess Verification is a great alternative to [reCAPTCHA](https://www.google.com/recaptcha/about/), [hCaptcha](https://www.hcaptcha.com/) and [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)

## License

This project is licensed under the Apache-2.0 License, please see the [LICENSE](https://github.com/tiagozip/cap/blob/main/LICENSE) file for details.

Copyright ©2025 - present [tiago](https://tiago.zip)

<!--

<a href="https://www.digitalocean.com/">
  <img src="https://opensource.nyc3.cdn.digitaloceanspaces.com/attribution/assets/SVG/DO_Logo_icon_blue.svg" width="30px">
</a>

Cap's free instance is supported by DigitalOcean for open-source. <a href="https://www.digitalocean.com/?refcode=7e41cf645be3&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge">Try DigitalOcean</a> and get $250 worth of credits.
-->

---

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9920/badge?v=gold)](https://www.bestpractices.dev/projects/9920) [![](https://data.jsdelivr.com/v1/package/npm/@cap.js/wasm/badge)](https://www.jsdelivr.com/package/npm/@cap.js/wasm)
