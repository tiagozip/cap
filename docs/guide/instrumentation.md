---
description: "Cap's instrumentation challenges run a server-generated script to confirm a real browser, alongside proof-of-work in the self-hosted, open-source CAPTCHA."
---

# Instrumentation

Instrumentation challenges check that a challenge was solved in a real browser. They run next to the proof of work, are on by default for new Standalone keys, and are opt-in in the [core library](./capjs-core.md#instrumentation).

## How they work

For every challenge, the server generates a new JavaScript program. It starts from random integers and changes them through random operations, some of them plain arithmetic and some done through the DOM: it builds a tree of elements, walks back up it adding values, and removes it. The server tracks every operation as it generates them, so it knows the four numbers the program has to produce.

The widget runs the program in a sandboxed iframe and sends the result back with the proof of work. Plain arithmetic is easy to reproduce outside a browser, but the DOM steps need a real rendering engine. Runtimes that fake the DOM tend to skip parts of it or get it wrong.

The programs are obfuscated, from level 1 to 10. Higher levels are harder to analyse and slower to generate, and the default is 3.

## Automated browser detection

With **Attempt to block headless browsers** on in Standalone, or `blockAutomatedBrowsers` in core, the script also collects a few facts about the browser and the server checks them. The server makes the decision, since a check that runs only in the browser is easy to patch out.

The checks look for automation tools and tampering, never for which browser someone uses. Signals like codec support or browser brand are left out, because someone on a niche Chromium fork looks the same in them as a stealth bot on that fork.

## Interaction detection

This is experimental and off by default. Standalone's **Block automated clicks and typing** setting turns on `blockAutomatedInteractions`. In core, `detectAutomatedInteractions` reports without blocking.

While the instrumentation script runs, the widget counts clicks and key presses that scripts dispatched rather than the user. After three of either, blocking mode rejects the solve with `instr_automated_interaction`, which Standalone returns as `automated_interaction_detected`. Report-only mode puts `interaction_synthetic_clicks` or `interaction_synthetic_keydowns` in `riskFlags`, and Standalone includes them in the `/siteverify` response.

The widget doesn't require any interaction, so a visitor who never touches the page passes. It doesn't read field values, and it ignores touch, pen, password fields, one-time code fields, shortcuts and paste. Accessibility tools can also dispatch synthetic events, and they haven't been tested against this, which is why it stays off by default.

## Limits

Instrumentation doesn't replace proof of work. Without it, an attacker running many real browsers could solve these scripts cheaply. Large platforms like [YouTube](https://www.reddit.com/r/youtubedl/comments/1mkzmp3/what_is_a_po_token/) and [X](https://x.com/i/js_inst) use similar challenges, and Cap pairs them with proof of work so each solve has a cost.
