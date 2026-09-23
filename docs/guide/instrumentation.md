---
description: "Cap's instrumentation challenges run server-generated JS to verify a real browser, working alongside proof-of-work in the self-hosted, open-source CAPTCHA."
---

# Instrumentation challenges

Instrumentation challenges are Cap's second layer of verification, running silently alongside the core proof-of-work system and present on Cap Standalone.

They generate a unique JavaScript program on every request that is executed inside the visitor's browser. The output is checked server-side, allowing Cap to confirm that a genuine browser environment is present before accepting a token.

## How they work

When a challenge is issued, the server generates a self-contained JavaScript bundle that runs a few browser API probes and evaluates a main computation chain, where multiple integer variables are initialised with random seed values and then mutated through randomised operations, including bitwise AND/OR/XOR/NAND, prototype-chain tricks, and DOM-based arithmetic that appends a tree of elements to the page, walks back up it accumulating values, and then removes them.

The server tracks the expected result of every operation in parallel, so it knows what the final four values must be.

All of these checks run inside an iframe, which `postMessage`s the answers back to the parent.

## Why DOM operations

Pure arithmetic can be replicated in a non-browser environment by simply running the JavaScript. DOM operations cannot - or at least, not cheaply. Constructing real element trees, reading values through the browser's layout engine, and tearing them down again exercises a part of the browser that non-browser runtimes often stub out, do incorrectly, or skip entirely for performance. This makes the challenge harder to replay outside a genuine rendering engine.

Instrumentation challenges often also mix these with a preset list of checks.

## Automated browser detection

With `blockAutomatedBrowsers` enabled, the instrumentation script also collects a small vector of browser facts (text metrics, window geometry, `navigator.webdriver`, engine markers) and ships it back with the computation result. The server runs the detector over that vector. A client-side-only check is a suggestion that a stealth browser patches out, so nothing here trusts the client's own verdict.

Seven checks can fail a request. Every one of them targets the automation layer or tampering, never which browser build you run. Widevine, H.264, `userAgentData` brand and similar build identity signals are not used to block, because a person on ungoogled-chromium looks identical to a stealth driver on the same binary in those fields.

| Check | What it catches | Why it is safe for humans |
| --- | --- | --- |
| `geometry_quantized` | Camoufox snaps text advance widths to whole pixels. Real Blink, Gecko and WebKit return fractional widths, and Firefox's resist-fingerprinting mode does not round them either. | Requires at least 5 of 17 font stacks to be whole pixels **and** at least 2 distinct integer values, so a single-font system cannot trip it. |
| `webdriver_true` | Plain Selenium, Playwright, Puppeteer, rebrowser. | Spec-defined automation flag. No shipping browser sets it. |
| `webdriver_stripped` | Stealth patches that delete `navigator.webdriver` on Chromium. | Real Chrome always exposes it as `false`. |
| `gecko_contradiction` | Spoofers exposing `navigator.deviceMemory` or `userAgentData` on a Gecko engine. | Firefox has never shipped either API. |
| `window_exceeds_screen` | CDP `Emulation.setDeviceMetricsOverride` shrinks `screen` to the viewport and leaves the window taller than the display. | Skipped when `screen.isExtended` is true, so a taller second monitor passes. |
| `viewport_override` | Viewport exactly equal to the screen while browser chrome is present. | Skipped on mobile, where a full-screen viewport is normal. |
| `headless_token` | `HeadlessChrome` in the UA or `userAgentData.brands`. | No consumer browser exposes it. |

Two more signals are collected but never block:

- `native_tamper`: `Function.prototype.toString` on canvas, WebGL and permissions methods is no longer `[native code]`. This catches puppeteer-stealth and selenium-stealth, but privacy extensions (Canvas Blocker, Chameleon, Trace) patch the exact same methods. It is returned as a risk flag so you can raise proof-of-work difficulty instead of blocking.
- Browser-surface clusters (no `window.chrome`, no plugins, no PDF viewer) are not used at all. Mobile Chrome and Android WebView legitimately match all three.

When a request is blocked, `validateChallenge` returns `reason: "instr_automated_browser"` with a `blockedBy` array naming the failed checks. Successful validations carry `riskFlags`. Cap Standalone surfaces the same reason as `automated_browser_detected`.

Known gaps: `undetected-chromedriver` and `nodriver` driving a headful stock Chrome pass all seven checks. Headless Firefox passes too, since Gecko has no `HeadlessChrome` equivalent. Even commercial CAPTCHAs like Turnstile are bypassed by these tools, and proof-of-work remains the layer that makes such traffic expensive.

Open false-positive risks that have not been measured yet: Tor Browser's text metric rounding against `geometry_quantized`, and mixed-DPI multi-monitor setups against `window_exceeds_screen`. If you run either and see blocks, please open an issue with the `blockedBy` value.

## Relationship to proof-of-work

Instrumentation challenges and proof-of-work are complementary, not redundant. Proof-of-work proves *effort*: the client had to burn CPU cycles to find a hash. Instrumentation proves *environment*: the computation happened inside a browser, not a script. Together they raise the cost of abuse on two independent axes - neither alone is sufficient against a determined attacker, but both together are substantially harder to defeat simultaneously.

Instrumentation is not foolproof. While challenges like these are deployed at massive scale by platforms such as [YouTube](https://www.reddit.com/r/youtubedl/comments/1mkzmp3/what_is_a_po_token/) and [Twitter](https://x.com/i/js_inst), I do not recommend using them as a replacement for proof-of-work. Without PoW and with real browsers, attackers can cheaply mine these challenges.