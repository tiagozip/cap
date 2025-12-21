# Effectiveness

Cap significantly reduces spam and abuse on websites and web apps. It won't stop _everything_ (no CAPTCHA is foolproof), however, it minimizes the potential for abuse by making it expensive.

The main principle behind implementing a proof-of-work CAPTCHA like Cap includes **proving effort** instead of fingerprinting or solving visual puzzles.

## Privacy & security

Cap doesn't use cookies or telemetry by default. No data is collected or stored in our servers as it's fully self-hosted.

## Why proof-of-work?

Every CAPTCHA can eventually be solved, whether by AIs, algorithms, reverse-engineering and spoofing fingerprints, or humans paid via CAPTCHA farms — this results in an endless cat-and-mouse game between attackers and defenders. The crucial difference lies in the cost imposed on attackers.

Cap's goal is to make automated abuse expensive while keeping the experience fast and virtually invisible for real users. Proof-of-work is a perfect balance for this issue, stopping abuse by requiring computational effort rather than relying solely on human verification methods that bots continuously learn to mimic.

Imagine sending 10,000 spam messages costs $1, potentially earning $10 – a profitable venture. If Cap increases the computational cost so that sending those messages now costs $100, the spammer loses $90. This eliminates the financial incentive.

Cap's proof-of-work is heavily inspired by [Hashcash](https://www.researchgate.net/publication/2482110_Hashcash_-_A_Denial_of_Service_Counter-Measure).