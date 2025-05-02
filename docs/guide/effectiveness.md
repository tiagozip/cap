# Effectiveness

Cap significantly reduces spam and abuse on websites and web apps. It won't stop _everything_ (no CAPTCHA is foolproof), however, it minimizes the potential for abuse by making it expensive. The main principle behind implementing a proof-of-work CAPTCHA like Cap includes **proving effort** instead of basic fingerprinting or solving puzzles to verify whether someone is human.

## Privacy & security

Cap doesn't use cookies or telemetry by default. No data is collected or stored in our servers.

By default, Cap's server library uses the following defaults:

- **Challenge storage:** Challenges are only stored in memory on the server to prevent tampering and expire after 10 mins
- **Token storage:** Only hashed tokens are stored persistently (in `.data/tokensList.json` by default) to validate user sessions, and they also expire (20 minutes by default).

## Why Proof-of-work?

Every CAPTCHA can eventually be solved, whether by AIs, algorithms or humans paid via CAPTCHA farms — this results in an endless cat and mouse game between attackers and defenders. The crucial difference lies in the _cost_ imposed on attackers.

Cap's goal is to make automated abuse expensive while keeping the experience fast and virtually invisible for real users. PoW is a perfect balance for this issue, stopping abuse by requiring computational effort rather than relying solely on human verification methods that bots continuously learn to mimic.

Imagine sending 10,000 spam messages costs $1, potentially earning $10 – a profitable venture. If Cap increases the computational cost so that sending those messages now costs $100, the spammer loses $90. This eliminates the financial incentive.

For a deeper dive into the technical aspects, you might find [this research paper](https://www.researchgate.net/publication/374638786_Proof-of-Work_CAPTCHA_with_password_cracking_functionality) useful.
