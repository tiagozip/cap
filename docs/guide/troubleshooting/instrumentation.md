---
sidebar: false
editLink: false
prev: false
next: false
footer: false
description: "Troubleshooting Cap verification failures: fixes for the open-source, self-hosted CAPTCHA when proof-of-work or instrumentation checks fail in your browser."
---

# Troubleshooting

Verification can fail for reasons that have nothing to do with bots. Try these in order.

1. **Open a private window.** This rules out extensions and cached data. In Chrome and Edge, press `Ctrl+Shift+N`, or `Cmd+Shift+N` on a Mac. In Firefox, press `Ctrl+Shift+P`, or `Cmd+Shift+P`. In Safari, choose **File > New Private Window**.
2. **Turn off your extensions,** reload, and try again. If that works, turn them back on one at a time to find the one causing it.
3. **Update your browser** and restart it.
4. **Try another browser or device,** like your phone. Internet Explorer isn't supported.
5. **Try another network.** School and office networks sometimes block verification, so a phone hotspot is a quick test.
6. **Use a normal browser window.** Browsers controlled by automation tools like Selenium, Puppeteer or Playwright are blocked, and so are AI agent browsers.

If none of this works, contact the site's owner, or [open an issue](https://github.com/tiagozip/cap/issues).
