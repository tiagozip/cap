---
description: "How Cap works: the self-hosted CAPTCHA makes each visitor's browser solve a proof-of-work challenge and run an instrumentation script, then trades the result for a single-use token."
---

# How Cap works

Cap doesn't try to decide whether a visitor is human. It makes every request cost some computation, which is cheap for one visitor and expensive for someone sending thousands, and it checks that the computation ran in a real browser.

## What happens on a request

1. Once the widget is visible, it asks your server for a challenge. The server replies with a signed token that describes the challenge, and usually an instrumentation script as well. The widget starts the script in a sandboxed iframe right away.
2. The browser solves the proof of work in Web Workers, using WebAssembly. Depending on the challenge, it starts on the visitor's first interaction with the page or when they click the widget.
3. The widget collects the instrumentation result and sends both results to the server. The server checks the token's signature and the proof of work, marks the challenge as redeemed, and then checks the instrumentation result.
4. If everything passes, the server issues a single-use token. The widget puts it in your form, and your backend verifies it with `/siteverify` before trusting the submission.

The server keeps no state for an open challenge, since everything it needs is in the signed token. It only stores redeemed challenges and the tokens it issued.

## Why proof of work

Every CAPTCHA can be solved eventually, whether by image models, by reverse engineering, or by people paid per solve. What a CAPTCHA can control is what each solve costs.

Say a spammer pays $1 to send 10,000 messages and earns $10 from them. If Cap raises the cost of those messages to $100, the campaign loses money. A visitor filling in one form pays about half a second of CPU, and never sees a puzzle.

The idea comes from [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure).

## The two layers

**Proof of work** shows the client spent the computation. With SHA-256, a GPU clears about 150 times as many challenges per second as a CPU, which lets an attacker buy their way out cheaply. [HashWX](./hashwx.md), the default, cuts that to about 2 times.

**[Instrumentation](./instrumentation.md)** shows the computation ran in a browser. Each challenge comes with a freshly generated script that does arithmetic through the DOM, and the server knows the answer it should produce. Running it outside a real browser engine is hard. It can also detect common automation tools and AI agents, and score how the visitor's pointer and keyboard input reached the widget.

Each layer covers the other's gap. Proof of work alone can be solved by a script without a browser, and instrumentation alone can be mined cheaply by many real browsers. Neither stops a farm of people solving by hand, but the proof of work still makes each of their solves cost something.

## Privacy

Cap sets no cookies and collects no telemetry. Challenges, tokens and stats stay on your server. With behavior scoring on, the widget sends your server the visitor's pointer movement and key timing, but never which keys were pressed or what was typed. The widget calls the endpoint you give it, and jsDelivr for its WASM files unless you [self-host them](./widget.md#self-hosting-the-widget). See [compliance](./compliance.md) for GDPR, CCPA and accessibility.
