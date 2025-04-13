# Effectiveness

Cap is designed to reduce spam and abuse on websites and web apps. While it won't block all spam, it's highly effective at keeping most bots away.

## How PoW works

Cap uses a Proof-of-Work (PoW) system, similar to Friendly Captcha and Altcha. Instead of simply verifying if you're human by analysing your mouse movement and interaction with the website, Cap creates a computational task that bots find hard to solve.

When you verify yourself, Cap asks the server for multiple challenges (we use multiple challenges in order to help adjust difficulty levels and track progress more accurately), which include a unique salt and target. The server generates these challenges and sends them to the Cap widget. Using Web Workers and WASM, Cap tries to find a challenge with a hash starting with a specific string for each challenge by combining the salt with a random string.

Once solved, the widget sends the results back to the server for validation. If successful, the server gives a token that can be used to prove you're human. This extra complexity makes it much harder for simple bots to bypass.

## Privacy

Cap is fully compliant with GDPR and CCPA. It doesn't use cookies or track you in intrusive ways. We never sell your data, and we don't even collect personal information. No ads, no tracking. Period.

## Security

- IP addresses are not stored by default
- Challenges are stored in memory to make sure they are not tampered with (expire after 10 minutes by default), while tokens are stored in a file (hashed tokens only, this is `.data/tokensList.json` by default and expire after 20 minutes)

## Why you might not want to use this

Cap isn't a silver bullet: it won’t block all spam, but it will significantly reduce it. The core principle behind proof-of-work CAPTCHAs is that they are designed to prove effort rather than just verifying a human user.

**Here's an example:**

Imagine I can send 10,000 emails to 10,000 random recipients for $1. If I can earn $10 in return from these emails, it becomes highly profitable. However, if the cost of sending these emails increases from $1 to $100, it is no longer profitable. In fact, I would be losing money. This is where CAPTCHA logic comes into play: by making the cost of spamming increase dramatically, we can reduce its viability.

By applying similar concepts to CAPTCHA, we make it costly for bots to spam, effectively discouraging them from trying.

If you want to read more about proof-of-work, I recommend reading [this whitepaper](https://www.researchgate.net/publication/374638786_Proof-of-Work_CAPTCHA_with_password_cracking_functionality)


## Why proof-of-work?

Every captcha is solvable by bots or by paid humans. The only question is how to make it costly for bots but invisible for users. Proof-of-work is the perfect balance for this problem.