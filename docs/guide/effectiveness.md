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