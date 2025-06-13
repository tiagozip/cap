# About checkpoints

Cap's Checkpoints (previously known as middlewares) allow you to replicate Cloudflare's browser check interstitial. This helps prevent bots, LLMs and automated abuse from ever reaching your website.

They're extremely simple to set up and use, with you only having to add a few lines of code to your server, unlike moving your entire website over to Cloudflare. Note that this is kind of a nuclear solution, as it _will_ also impact good bots such as search engine crawlers.

![Example of Cap's checkpoint](./demo.png)

## How do Checkpoints work?

Checkpoints work by intercepting requests to your server and checking if the user has a valid `__cap_clearance` cookie. If the cookie is present and valid, the request is allowed to proceed. If not, the user is redirected to a challenge page.