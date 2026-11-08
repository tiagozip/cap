---
outline: [2, 3]
description: "Set up Cap, the open-source self-hosted CAPTCHA, in about five minutes. Run the server with Docker or inside your own backend, add the widget, verify tokens. No Google, no telemetry, no visual puzzles."
---

# Quickstart

Cap has two parts: a widget, which runs and solves challenges in the visitor's browser and gives you a token; and the server (capd), which issues challenges and verifies those tokens.

## 1. Set up capd

First, you'll need to set up capd. It runs as a self-hosted server with a dashboard, analytics, rules, and an API. Keys and settings are stored in Valkey. Before you start, you'll need to make two choices:

**1. Where to run capd:** You can run it on your own server with Docker, use [Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic), or use a serverless platform like [Workers](./capd/workers.md). This guide uses Docker.

**2. Where to store analytics:** You can use DuckDB (lightweight, best for small websites) or ClickHouse (more scalable). Both are easy to set up and built-in.

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

Open `http://localhost:3000` and log in with the `ADMIN_KEY` from `.env`, which is the dashboard password. Create a site key and copy both the site key and its secret.

The widget talks to this server from your visitors' browsers, so in production it needs a public URL. We recommend using something like [Tunnels](https://developers.cloudflare.com/tunnel/), but [the capd docs](./capd/index.md) cover most other cases, including reverse proxies.

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

The endpoint is `https://<your-instance>/<site-key>/`.

When the visitor solves it, the widget adds a hidden `cap-token` field to the form. Outside a form, listen for the `solve` event instead:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

The [widget page](./widget.md) has snippets for React, Vue, Svelte and other frameworks.

## 3. Verify the token

Before you trust a submission, send its token to `/siteverify` from your server:

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

If you're moving from reCAPTCHA, `/siteverify` takes the same request format, so your verification code only needs your server's hostname.

A valid token returns `{ "success": true }`. Each token works once, so a second verification of the same token fails. Sending it twice is a quick way to check the setup end to end.

## Using the core library instead

If you'd rather issue and check challenges inside your own backend, the [core library](./capjs-core.md) is a minimal npm package that does only that. You store tokens in your own database, and you don't get the dashboard, analytics or rate limiting.

## Next steps

- [Customize the widget](./widget.md#attributes): its labels, language and styling
- [Configure capd](./capd/options.md): proxies, widget files and the API
- Read the [core library reference](./capjs-core.md)
- Read [how Cap works](./workings.md)
