---
description: "Cap's instrumentation challenges run server-generated JS to verify a real browser, working alongside proof-of-work in the self-hosted, open-source CAPTCHA."
---

# Instrumentation challenges

Instrumentation challenges are Cap's second layer of verification, running silently alongside the core proof-of-work system and present on Cap Standalone.

They generate a unique JavaScript program on every request that is executed inside the visitor's browser. The output is checked server-side, allowing Cap to verify that the script ran against a browser-shaped environment before accepting a token. Note that this is a best-effort signal, not proof of a genuine browser: the computation is deterministic given the script, so a sufficiently complete fake DOM can in principle reproduce it outside a browser.

## How they work

When a challenge is issued, the server generates a self-contained JavaScript bundle that runs a few browser API probes and evaluates a main computation chain, where multiple integer variables are initialised with random seed values and then mutated through randomised operations, including bitwise AND/OR/XOR/NAND, prototype-chain tricks, and DOM-based arithmetic that appends a tree of elements to the page, walks back up it accumulating values, and then removes them.

The server tracks the expected result of every operation in parallel, so it knows what the final four values must be.

All of these checks run inside an iframe, which `postMessage`s the answers back to the parent.

## Why DOM operations

Pure arithmetic can be replicated in a non-browser environment by simply running the JavaScript. DOM operations make this harder - but only if they exercise semantics a fake DOM cannot cheaply reproduce. Simple `innerText` round-trips and element-tree walks can be stubbed correctly with a small fake DOM, so on their own they are a speed bump rather than a barrier. Layout-dependent reads (CSS box-model geometry via `offsetWidth`/`offsetHeight`/`getBoundingClientRect`) require an actual layout engine and raise the replay cost significantly. This is why the built-in probes include layout-dependent checks, and why instrumentation should always be paired with proof-of-work.

Instrumentation challenges often also mix these with a preset list of checks.

## Automated browser detection

Instrumentation challenges can also optionally attempt to block automated webdrivers. While we do a very large amount of checks for these, they are not foolproof. Even commercial, closed-source CAPTCHAs, like Turnstile, can be bypassed by attackers by using patched stealth browsers.

## Relationship to proof-of-work

Instrumentation challenges and proof-of-work are complementary, not redundant. Proof-of-work proves *effort*: the client had to burn CPU cycles to find a hash. Instrumentation proves *environment*: the computation happened inside a browser, not a script. Together they raise the cost of abuse on two independent axes - neither alone is sufficient against a determined attacker, but both together are substantially harder to defeat simultaneously.

Instrumentation is not foolproof. While challenges like these are deployed at massive scale by platforms such as [YouTube](https://www.reddit.com/r/youtubedl/comments/1mkzmp3/what_is_a_po_token/) and [Twitter](https://x.com/i/js_inst), I do not recommend using them as a replacement for proof-of-work. Without PoW and with real browsers, attackers can cheaply mine these challenges.