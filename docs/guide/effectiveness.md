# Effectiveness

Cap reduces spam and abuse on websites and web apps. While it won't block _all_ spam (no CAPTCHA is a silver bullet), it significantly reduces it by making automated abuse costly. The core principle behind proof-of-work CAPTCHAs like Cap is **proving effort** rather than just verifying if you're human through interaction analysis or complex puzzles.

When you verify yourself, Cap performs these steps:

1. **Requests Challenges:** Asks the server for multiple unique challenges. Each includes a salt and a target difficulty. (Using multiple challenges helps adjust difficulty and track progress.)
2. **Solves Computationally:** Uses Web Workers and WebAssembly (WASM) on your device to rapidly test nonce values, combining them with the challenge salt. In case 
3. **Finds Solutions:** Continues until it finds solutions whose cryptographic hashes meet the target difficulty specified in the challenges.
4. **Validates:** Sends the successful nonce solutions back to the server for validation.
5. **Issues Token:** If validation succeeds, the server issues a short-lived token that proves the work was done, granting access.

This computational work makes spam expensive for attackers but remains quick (typically milliseconds) and unintrusive for legitimate users.

**Example: The Economics of Spam**
Imagine sending 10,000 spam messages costs $1, potentially earning $10 – a profitable venture. If Cap increases the computational cost so that sending those messages now costs $100, the spammer loses $90. This eliminates the financial incentive.

## Privacy & Security

Cap prioritizes user privacy and is designed to be GDPR and CCPA compliant.

- **No Tracking:** It doesn't use cookies or employ intrusive tracking methods.
- **No Data Selling:** We never sell user data.
- **Minimal Data:** We don't collect personal information beyond what's essential for the PoW process itself. No ads, no tracking, no telemetry. Period.
- **IP Addresses:** Not stored by default.
- **Challenge Storage:** Challenges exist only in memory on the server to prevent tampering and expire quickly (10 minutes by default).
- **Token Storage:** Only _hashed_ tokens are stored persistently (in `.data/tokensList.json` by default) to validate user sessions, and they also expire (20 minutes by default).

## Why Proof-of-Work?

Every CAPTCHA can eventually be solved, whether by sophisticated bots or humans paid via CAPTCHA farms. The crucial difference lies in the _cost_ imposed on attackers.

The goal is to make automated abuse expensive while keeping the experience fast and virtually invisible for real users. Proof-of-work is a perfect balance, stopping abuse by requiring computational effort rather than relying solely on human verification methods that bots continuously learn to mimic.

For a deeper dive into the technical aspects, you might find [this research paper](https://www.researchgate.net/publication/374638786_Proof-of-Work_CAPTCHA_with_password_cracking_functionality) useful.