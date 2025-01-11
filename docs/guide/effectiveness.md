# Effectiveness

Cap is designed to reduce spam and abuse on websites and web apps. While it won’t block all spam, it’s highly effective at keeping most bots at bay.

## The PoW mechanism

Cap uses a Proof-of-Work (PoW) system, similar to Friendly Captcha, but with a focus on adding complexity to discourage spammers and automated bots. Instead of simply verifying if you're human, Cap creates a computational task that bots find hard to solve.

When you verify yourself, Cap asks the server for multiple challenges (we use multiple challenges in order to help adjust difficulty levels and track progress more accurately), which include a unique salt and target. The server generates these challenges and sends them to the Cap widget. Using Web Workers and WebAssembly (WASM), Cap tries to find a specific hash for each challenge by combining the salt with a random number (nonce).

Once solved, the widget sends the results back to the server for validation. If successful, the server gives a token that can be used to prove you're human. This extra complexity makes it much harder for simple bots to bypass.

## Privacy

Cap is fully compliant with GDPR and CCPA. It doesn’t use cookies or track you in intrusive ways. We never sell your data, and we don't even collect personal information. No ads, no tracking. Period.

## Security

* IP addresses are only stored in-memory
* Requests are stored in-memory in make sure they are not tampered with (hashed tokens only, this is stored in .data/tokensList.json by default)
* Confirmation tokens reset after 20 minutes
* Challenges are only valid for 10 minutes