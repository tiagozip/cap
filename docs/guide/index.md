---
outline: deep
description: "Set up Cap, the open-source self-hosted CAPTCHA, in about five minutes. Run the server with Docker, drop in the widget, verify tokens. No Google, no telemetry, no visual puzzles."
---

# Quickstart

Cap is a self-hosted CAPTCHA that replaces image puzzles with invisible proof-of-work. Your users click one checkbox, the work runs silently in their browser, and none of their data ever leaves your servers. No Google, no telemetry, no per-request fees.

Cap has two parts: a **widget** that runs the challenge and shows the checkbox, and a **server** that issues challenges and verifies solutions. You'll have both running in about five minutes.

**Here's the widget, live:**

<Demo />

::: tip Already using reCAPTCHA?
Cap's `/siteverify` is compatible with reCAPTCHA's API. You can point your existing verification code at Cap by changing one URL, run both side by side, and cut over whenever you're ready. There's no rewrite and no risky big-bang switch. See the [feature comparison](./alternatives.md).
:::

## What you'll need

- [Docker](https://docs.docker.com/get-docker/) (the fastest way to run the server)
- A place to host it that's reachable from your users' browsers
- A few minutes

## 1. Run the server

We recommend [Cap Standalone](./standalone/index.md), a single container that exposes a small REST API and a dashboard for managing keys. It supports multiple site keys and is compatible with reCAPTCHA's siteverify API.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)

Create a `docker-compose.yml`:

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
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

Start it:

```bash
docker compose up -d
```

Open `http://localhost:3000` (or your server's IP or domain on port 3000), log in with your `ADMIN_KEY`, and create a site key. You'll get a **site key** and a **secret key**. Keep both, you'll need them in the next steps.

::: tip Tips

- `ADMIN_KEY` is your dashboard password. Make it at least 32 characters.
- Change `3000:3000` if that port is already in use.
- If the dashboard is unreachable, add `network_mode: "host"` under the `cap` service.
  :::

## 2. Add the widget

The widget is a single web component. If you wouldn't like to pin versions, replace `<version>` with `latest`.

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

::: tip
Check the [latest release](https://github.com/tiagozip/cap/releases) for the version to pin. In high-security setups you can self-host this file instead of loading it from the CDN.
:::

### The simple way: drop it in a form

If your widget lives inside a `<form>`, Cap injects a hidden `cap-token` field automatically and submits it with the rest of your form data. No JavaScript required.

```html
<form action="/submit" method="POST">
  <!-- your fields -->
  <cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

- `<your-instance>` is the public URL of your Cap server, e.g. `cap.example.com`. It has to be reachable by your visitors, so not `localhost`.
- `<site-key>` is the site key from your dashboard.

On submit, your server receives `cap-token` alongside the other fields. Skip to [step 3](#_3-verify-the-token) to verify it.

### With JavaScript: when you need control

For SPAs, custom flows, or anything that isn't a plain form, listen for the `solve` event:

```js
const widget = document.querySelector("cap-widget");
widget.addEventListener("solve", (e) => {
  const token = e.detail.token;
  // send token to your server, enable the submit button, etc.
});
```

You can also render the widget invisibly and solve [programmatically](./programmatic.md), or use [floating mode](./floating.md). Framework snippets (React, Vue, Svelte and more) are on the [widget page](./widget.md#usage).

## 3. Verify the token

Before you trust a submission, your server has to verify the token. Send a `POST` to your instance's `/siteverify` endpoint:

::: code-group

```sh [curl]
curl "https://<your-instance>/<site-key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

```js [fetch]
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "<key_secret>", response: "<captcha_token>" }),
  })
).json();

if (!success) throw new Error("invalid cap token");
```

```py [python]
import requests

success = requests.post(
    "https://<your-instance>/<site-key>/siteverify",
    json={"secret": "<key_secret>", "response": "<captcha_token>"},
).json().get("success")
```

```php [php]
<?php
$data = json_decode(file_get_contents("https://<your-instance>/<site-key>/siteverify",
  false, stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json",
      "content" => json_encode(["secret"=>"<key_secret>","response"=>"<captcha_token>"])
    ]
  ])
), true);
var_dump($data['success'] ?? false);
```

:::

- `<key_secret>` is the **secret key** from your dashboard, not the dashboard `ADMIN_KEY`. Mixing these up is the most common setup mistake.
- `<captcha_token>` is the token from the widget (the `cap-token` form field or `e.detail.token`).

A valid token returns:

```json
{ "success": true }
```

Tokens are single-use, so verify each one once and then run your own logic (create the account, send the message, and so on).

## 4. Confirm it works

A quick end-to-end check:

1. Load your page. The checkbox should tick and your `solve` handler (or form field) should produce a token.
2. Send that token to `/siteverify`. You should get `{ "success": true }`.
3. Send the same token again. It should now fail, which confirms single-use is working.

If verification always fails, check that you're using the secret key (not the admin key) and that `<your-instance>` is the same public URL the widget points at.

That's the whole integration. Users solve challenges in their browser, your server verifies tokens, and you keep every byte of the data.

## Built for compliance

Because Cap is self-hosted with no cookies, no tracking, and no third-party calls, your users' data never leaves your infrastructure. Cap is designed to meet GDPR, CCPA, HIPAA, LGPD and other privacy regimes, and the proof-of-work checkbox avoids the WCAG 2.2 barriers that image and audio puzzles run into. Full details, and the regulations Cap is built around, are on the [Compliance](./compliance.md) page.

## Next steps

You're protecting your forms. From here you can:

- Drop Cap into your stack with a [framework snippet](./widget.md#usage)
- [Customize the widget](./widget.md#options)'s look and behavior
- Tune [instrumentation](./instrumentation.md) and [configure](./standalone/options.md) CORS and rate limiting
- See how Cap compares to [reCAPTCHA, Turnstile, hCaptcha and others](./alternatives.md)
- Read the [best CAPTCHA alternatives for 2026](./best-captcha-alternatives.md) guide if you're still evaluating
