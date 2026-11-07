---
outline: [2, 3]
description: "Set up Cap, the open-source self-hosted CAPTCHA, in about five minutes. Run the server with Docker or inside your own backend, add the widget, verify tokens. No Google, no telemetry, no visual puzzles."
---

# Quickstart

Cap has two parts: a widget, which runs and solves challenges in the visitor's browser and gives you a token; and the server, which issues challenges and verifies those tokens.

## Pick a server

- **[Standalone](./standalone/index.md)** is a Docker container with a dashboard, analytics and rate limiting. Pick it if you can run a container. If you're moving from reCAPTCHA, Standalone's `/siteverify` supports the same request format, so your verification code only needs to use your server's hostname.

- **The [core library](./capjs-core.md)** is a minimal npm package which handles Cap's basics. It runs wherever your code does, including serverless platforms like Workers, and you store tokens in your own database, but doesn't support built-in analytics.

## 1. Run the server

### Standalone

Save this as `docker-compose.yml`, or [deploy with Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic):

```yaml
services:
  cap:
    image: tiago2/cap:latest
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: change_me_to_something_long
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

Make sure to change your admin key. Then start it:

```bash
docker compose up -d
```

Open `http://localhost:3000` and log in with your `ADMIN_KEY`, which is the dashboard password. Create a site key and copy both the site key and its secret.

The widget talks to this server from your visitors' browsers, so in production it needs a public URL. We recommend using something like [Tunnels](https://developers.cloudflare.com/tunnel/), but [the Standalone docs](./standalone/index.md) cover most other cases, including reverse proxies.

### Core library

Install it:

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

Add two routes under a common prefix. This example uses Hono and Redis, but any framework and any store with an atomic "set if missing" work:

```js
import { Hono } from "hono";
import { Redis } from "ioredis";
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const redis = new Redis(process.env.REDIS_URL);
const app = new Hono();

app.post("/cap/challenge", async (c) =>
  c.json(await generateChallenge(SECRET, { format: 2, protocols: ["hashwx", "instrumentation"] })),
);

app.post("/cap/redeem", async (c) => {
  const result = await validateChallenge(SECRET, await c.req.json(), {
    consumeNonce: async (sig, ttlMs) =>
      (await redis.set(`cap:nonce:${sig}`, "1", "NX", "PX", ttlMs)) === "OK",
  });
  if (result.success) {
    await redis.set(`cap:token:${result.tokenKey}`, "1", "PX", result.expires - Date.now());
  }
  return c.json(result);
});
```

`CAP_SECRET` signs every challenge. Make it long and random, and use the same one in every process.

## 2. Add the widget

Load the script, pinning a version from the [releases page](https://github.com/tiagozip/cap/releases):

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Put the widget inside your form:

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

With Standalone, the endpoint is `https://<your-instance>/<site-key>/`. With the core library, it's your route prefix, like `/cap/`.

When the visitor solves it, the widget adds a hidden `cap-token` field to the form. Outside a form, listen for the `solve` event instead:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

The [widget page](./widget.md) has snippets for React, Vue, Svelte and other frameworks.

## 3. Verify the token

Before you trust a submission, check its token on your server.

### Standalone

Send the token to `/siteverify`:

::: code-group

```js [fetch]
const res = await fetch("https://cap.example.com/<site-key>/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "<secret>", response: token }),
});
const { success } = await res.json();
```

```py [python]
import requests

success = requests.post(
    "https://cap.example.com/<site-key>/siteverify",
    json={"secret": "<secret>", "response": token},
).json()["success"]
```

```php [php]
$res = file_get_contents("https://cap.example.com/<site-key>/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => "<secret>", "response" => $token]),
  ],
]));
$success = json_decode($res, true)["success"] ?? false;
```

```sh [curl]
curl -X POST "https://cap.example.com/<site-key>/siteverify" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<secret>", "response": "<token>"}'
```

:::

`<secret>` is the site key's secret, not your `ADMIN_KEY`. Mixing the two up is the most common setup mistake.

A valid token returns `{ "success": true }`. Each token works once, so a second verification of the same token fails. Sending it twice is a quick way to check the setup end to end.

### Core library

Look the token up in the store your redeem route wrote to, then delete it so it can't be used twice:

```js
import { createHash } from "node:crypto";

app.post("/submit", async (c) => {
  const [id, secret] = String((await c.req.parseBody())["cap-token"] ?? "").split(":");
  const key = `cap:token:${id}:${createHash("sha256")
    .update(secret ?? "")
    .digest("hex")}`;

  if ((await redis.del(key)) !== 1) {
    return c.text("invalid captcha", 403);
  }
});
```

## Next steps

- [Customize the widget](./widget.md#attributes): its labels, language and styling
- [Configure Standalone](./standalone/options.md): CORS, rate limits and the asset server
- Read the [core library reference](./capjs-core.md)
- Read [how Cap works](./workings.md)
