---
description: "Cap Standalone is the easiest way to self-host the open-source CAPTCHA backend: one Docker container with a dashboard, multiple site keys and a reCAPTCHA-compatible API."
---

# Standalone

Cap Standalone is the Cap server as a Docker image. It serves challenges to the widget, verifies tokens for your backend, and has a dashboard for site keys, stats and settings. It runs on Bun, idles at about 50 MB of memory, and stores everything in Redis or Valkey.

Use the [core library](../capjs-core.md) instead if you can't run a container, or want challenges inside an existing service or on a serverless platform.

## Running it

The [quickstart](../index.md#_1-run-the-server) has a compose file that runs Standalone with Valkey. Two environment variables matter on first run:

- `ADMIN_KEY` is the dashboard password. The server refuses to start without one, or with one shorter than 12 characters.
- `REDIS_URL` points at Redis or Valkey. It defaults to `redis://localhost:6379`.

Everything else is in [Configuration](./options.md).

To update, pull the new image and recreate the container:

```bash
docker compose pull && docker compose up -d
```

## Putting it online

The widget calls Standalone from your visitors' browsers, so the server needs a public HTTPS URL. Put it behind your usual reverse proxy and keep port 3000 closed to the internet.

Standalone rate-limits challenges per client IP, which only works if it sees the real IP. Read [client IPs behind a proxy](./options.md#client-ips-behind-a-proxy) before you go live, otherwise every visitor shares one rate-limit bucket.

## Site keys

Each site key has its own secret, stats and settings: the challenge protocol and difficulty, [instrumentation](../instrumentation.md), rate limits and block rules. New keys use [HashWX](../hashwx.md) with instrumentation on.

The secret is shown once, when you create the key. If you lose it, rotate it from the key's page.

## Endpoints

With a site key `abc123` on `cap.example.com`:

| URL | Called by |
| --- | --- |
| `https://cap.example.com/abc123/` | The widget, as `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | Your backend, with the secret and the token |
| `https://cap.example.com/` | You, for the dashboard |

`/siteverify` takes JSON with `secret` and `response`, like reCAPTCHA's, and returns `{ "success": true }` for a valid token. A failed check returns `success: false` with an `error` message and a 4xx status. Tokens work once.

The dashboard also has a [REST API](./options.md#api) for managing keys from scripts.
