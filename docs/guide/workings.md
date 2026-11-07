---
description: "How Cap works: the self-hosted CAPTCHA makes each visitor's browser solve a proof-of-work challenge and run an instrumentation script, then trades the result for a single-use token."
---

# How Cap works

Cap doesn't try to decide whether a visitor is human. It makes every request cost some computation, which is cheap for one visitor and expensive for someone sending thousands, and it checks that the computation ran in a real browser.

## What happens on a request

1. The widget asks your server for a challenge. The server replies with a signed token that describes the challenge, and usually an instrumentation script as well.
2. The browser solves the proof of work in Web Workers, using WebAssembly. At the same time, it runs the instrumentation script in a sandboxed iframe.
3. The widget sends both results to the server. The server checks the signature, verifies the solution, checks the instrumentation result, and makes sure the challenge hasn't been redeemed before.
4. If everything passes, the server issues a single-use token. The widget puts it in your form, and your backend verifies it with `/siteverify` before trusting the submission.

The server keeps no state for an open challenge, since everything it needs is in the signed token. It only stores the redeemed tokens.

## Why proof of work

Every CAPTCHA can be solved eventually, whether by image models, by reverse engineering, or by people paid per solve. What a CAPTCHA can control is what each solve costs.

Say a spammer pays $1 to send 10,000 messages and earns $10 from them. If Cap raises the cost of those messages to $100, the campaign loses money. A visitor filling in one form pays about half a second of CPU, and never sees a puzzle.

The idea comes from [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure).

## The two layers

**Proof of work** shows the client spent the computation. With SHA-256, a GPU clears about 150 times as many challenges per second as a CPU, which lets an attacker buy their way out cheaply. [HashWX](./hashwx.md), the default, cuts that to about 2 times.

**[Instrumentation](./instrumentation.md)** shows the computation ran in a browser. Each challenge comes with a freshly generated script that does arithmetic through the DOM, and the server knows the answer it should produce. Running it outside a real browser engine is hard, and it can also detect common automation tools.

Each layer covers the other's gap. Proof of work alone can be solved by a script without a browser, and instrumentation alone can be mined cheaply by many real browsers. Neither stops a farm of people solving by hand, but the proof of work still makes each of their solves cost something.

## Privacy

Cap sets no cookies and collects no telemetry. Challenges, tokens and stats stay on your server. The widget calls the endpoint you give it, and jsDelivr for its WASM files unless you [self-host them](./widget.md#self-hosting-the-widget). See [compliance](./compliance.md) for GDPR, CCPA and accessibility.
