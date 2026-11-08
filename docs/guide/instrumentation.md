---
outline: [2, 3]
description: "Cap's instrumentation challenges run a script generated per challenge in a sandboxed frame to confirm a real browser, alongside proof of work in the self-hosted, open-source CAPTCHA."
---

# Instrumentation

Instrumentation challenges check that a challenge was solved in a real browser. They run next to the proof of work, are on by default for new keys in capd, and are opt-in in the [core library](./capjs-core.md#instrumentation).

<InstrumentationFlow />

## How it works

Every challenge comes with a program the server has never sent before. Its arithmetic changes every time, so a solver has to parse and run each new program instead of replaying an old answer. Everything the program notes about the page is hashed into its answer, and the server recomputes that answer, so a client can't edit the notes without failing.

The frame shares the page's origin so the program can see the page around it. Pages with a strict Content Security Policy need `window.CAP_SCRIPT_NONCE`, and [pages with an HTML injection bug](./widget.md#pages-with-an-html-injection-bug) can isolate the frame with `CAP_ISOLATE`. Isolate it as well when the endpoint is a server you don't control, because without `CAP_ISOLATE` that server's script can run in your page.

## Automated browser detection

With **Attempt to block headless browsers** on in capd, or `blockAutomatedBrowsers` in core, the server blocks browsers that show automation markers: `navigator.webdriver`, headless user agents, stealth plugin patches, Playwright's Firefox protocol, or a page and Web Worker that disagree about the device. The checks look for automation and tampering, never for which browser someone uses. Failed checks are listed in `blockedBy`, and weaker hints go to `riskFlags` without blocking.

## Interaction detection

This is experimental and off by default. With **Block automated clicks and typing** on, the program counts clicks and key presses that a script dispatched instead of the visitor, and three of either fail the solve. It never reads field values, and it ignores password, one-time code and payment card fields.

## Behavior scoring

Behavior scoring is off by default and set per key. The program records how the pointer reached the widget and the rhythm of key presses, never which keys. The server turns that into a score from 0 to 1 and a verdict of `ok`, `suspicious`, `automated` or `agent`, and blocks `automated` at 0.75 by default. A straight-line pointer path, a script-dispatched press or typing at a perfectly even pace all push the score up.

[Invisible](./invisible.md) and [floating](./floating.md) modes call `solve()` without a press on the widget, so they fail on keys that require one.

## AI agent detection

Cap names AI agents from marks their tools leave in the page, from click and typing patterns, and from `User-Agent` and signed `Signature-Agent` headers. A detected agent adds `agent:<name>` to `riskFlags`. Keys can block every agent, only the ones identified with high confidence, or let agents with a verified [Web Bot Auth](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/) signature through.

## What it can't stop

The program runs in the visitor's browser, so the defenses make faking it cost more than running it: frozen built-ins, hashes over every field, results tied to one challenge, and failure markers that only ever fail. Cap still can't tell a person from a real browser that a person drives, so it doesn't stop paid human solvers, agents whose input arrives as ordinary operating system events, or browsers rebuilt from source to hide automation. Proof of work is what still charges each of those solves.

The failure codes are listed in [troubleshooting](./troubleshooting/instrumentation.md#error-codes).

## Widgets from earlier releases

Older widgets keep solving against a new server, and their solves carry the `legacy_widget` risk flag. They fail with `instr_widget_outdated` on keys that block automated interactions, score behavior or block agents. Updating the widget fixes it.
