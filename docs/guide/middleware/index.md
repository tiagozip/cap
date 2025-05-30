# About checkpoints/Middlewares

Cap's Checkpoints allow you to replicate Cloudflare's browser check interstitial. This helps prevent all bots, and automated abuse before they ever reach your website, not only submitting forms.

They're extremely simple to set up and use, with you only having to add a few lines of code to your server, unlike moving your entire website over to cloudflare.

![Example of Cap's checkpoint](./demo.png)

Note that this is kind of a nuclear solution, as it _will_ also impact good bots such as search engine crawlers.

This is currently only available for Elysia, but we plan to support more frameworks in the future, such as traefik or Hono.