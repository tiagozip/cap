# Options

## CORS

You can change the default CORS settings for redeeming and generating challenges by setting the `CORS_ORIGIN` environment variable when running the server. This defaults to `*`, which allows all origins. You can add multiple origins by separating them with commas, like `domain1.tld,domain2.tld,...`.

## Asset server

The asset server is disabled by default. You can enable it by setting the `ENABLE_ASSETS_SERVER` environment variable to `true`. This will serve the assets from the `/assets` endpoint.

Then, make sure to set `WIDGET_VERSION` and `WASM_VERSION` to the correct version of the widget and WASM files you want to serve. This defaults to `latest`, which will serve the latest version of the widget and WASM files, although these are not recommended in production as they might serve breaking changes.

Your assets will be served from the following paths:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/cap_wasm.js`

You can use these in your app by setting the widget's script source to the appropriate path, like this:

```html
<script src="https://<server url>/assets/widget.js"></script>
```

For the floating mode, use:

```html
<script src="https://<server url>/assets/floating.js"></script>
```

And by setting `window.CAP_CUSTOM_WASM_URL` to the path of the `cap_wasm.js` file, like this:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm.js";
```

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server.

## Rate-limiting

By default, Standalone will use Elysia's built-in `server.requestIP` function to identify a client's IP for ratelimiting. This might not be correct if you're using something like Cloudflare behind your service.

If so, you can change the IP extraction logic to simply read from a header set in `RATELIMIT_IP_HEADER` in your env. For example, if you were using Cloudflare, you might set `RATELIMIT_IP_HEADER` to `cf-connecting-ip`. On most setups, this is `x-forwarded-for`.

The `/siteverify` endpoint is intended for server-to-server use, so it's not ratelimited by default.

## Adaptive challenge count

You can increase the number of proof-of-work challenges dynamically based on request frequency. This is configured per site key from the dashboard's **Configuration** tab under **Adaptive challenge count**.

When enabled, you select a **time window** (1 minute to 1 hour) and define tiers at two levels:

### Global tiers

Increase the challenge count when the **total** number of challenge requests (across all IPs) exceeds a threshold within the time window. This is particularly effective against distributed attacks (botnets, proxy rotation) where each individual IP stays below per-IP limits.

### Per-IP tiers

Increase the challenge count when a **single IP** exceeds a request threshold within the time window. This targets repeat offenders without affecting legitimate users.

When both global and per-IP tiers are configured, the **highest** resulting challenge count is used. The base challenge count (set in the **Main** section) is always the minimum.

Example configuration:

| Level   | Min requests | Challenge count |
|---------|-------------|-----------------|
| Global  | 100         | 150             |
| Global  | 500         | 300             |
| Per-IP  | 5           | 150             |
| Per-IP  | 15          | 300             |

## Redis / Valkey

Cap Standalone uses Redis (or Valkey) for all data storage. Set the `REDIS_URL` environment variable to your Redis connection string. This defaults to `redis://localhost:6379`.

The recommended setup uses Valkey (a Redis-compatible store) via the docker-compose file provided in the [quickstart guide](/guide/standalone/).

## Error messages

Error messages are redacted by default and instead logged to the console. To disable error logging, set `DISABLE_ERROR_LOGGING=true`. To disable error message redaction, set `SHOW_ERRORS=true`.

## Instrumentation challenges

Cap Standalone supports JavaScript instrumentation challenges to defeat proof-of-work solvers, along with options to block headless browsers from solving them. Instrumentation challenges are enabled by default when creating new site keys.

You can toggle instrumentation challenges on or off in your site key config. To block headless browsers, turn on "Attempt to block headless browsers" in the key settings.
