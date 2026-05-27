---
description: "How effective Cap is against bots: the open-source CAPTCHA pairs proof-of-work with instrumentation to make abuse expensive while staying invisible to users."
---

# Effectiveness

## Privacy & security

Cap doesn't use cookies or any type of telemetry by default. No data is collected or stored on any central servers as it's fully self-hosted.

Cap includes replay protection and signature-based challenge tokens by default.

## Why proof-of-work?

Every CAPTCHA can eventually be solved, whether by AIs, algorithms, reverse-engineering and spoofing fingerprints, or humans paid via CAPTCHA farms, and this results in an endless cat-and-mouse game between attackers and defenders. The crucial difference lies in the cost imposed on attackers.

Cap's goal is to make automated abuse expensive and hard while keeping the experience fast and virtually invisible for real users. Proof-of-work is a perfect balance for this issue, stopping abuse by requiring computational effort rather than relying solely on human verification methods that bots continuously learn to mimic.

Imagine sending 10,000 spam messages costs $1, potentially earning $10 – a profitable venture. If Cap increases the computational cost so that sending those messages now costs $100, the spammer loses $90. This eliminates the financial incentive.

Cap's proof-of-work is heavily inspired by [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure). Our instrumentation challenges are inspired by Twitter and YouTube's own custom challenges.

## Making GPUs useless

SHA-256 is reasonable as a general PoW algorithm, but it can be significantly optimized on GPUs. That's why we also support experimental GPU-resistant algorithms like [RSW time-locks](./rsw.md).