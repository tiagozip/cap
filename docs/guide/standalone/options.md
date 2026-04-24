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

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server. The syntax of the files should be:

- `/npm/@cap.js/widget@${WIDGET_VERSION}` for `cap.min.js`
- `/npm/@cap.js/widget@${WIDGET_VERSION}/floating.js`
- `/npm/@cap.js/widget@${WIDGET_VERSION}/assets/cap_wasm_bg.wasm`
- `/npm/@cap.js/widget@${WIDGET_VERSION}/assets/cap_wasm.js`

You can also use `process.env.LOCAL_CACHE` to set a local/remote cache will the following syntax:

- `cap.min.js`
- `floating.js`
- `cap_wasm_bg.wasm`
- `cap_wasm.js`

## Rate-limiting

By default, Standalone will use Elysia's built-in `server.requestIP` function to identify a client's IP for ratelimiting. This might not be correct if you're using something like Cloudflare behind your service.

If so, you can change the IP extraction logic to simply read from a header set in `RATELIMIT_IP_HEADER` in your env. For example, if you were using Cloudflare, you might set `RATELIMIT_IP_HEADER` to `cf-connecting-ip`. On most setups, this is `x-forwarded-for`.

The `/siteverify` endpoint is intended for server-to-server use, so it's not ratelimited by default.

## Redis / Valkey

Cap Standalone uses Redis (or Valkey) for all data storage. Set the `REDIS_URL` environment variable to your Redis connection string. This defaults to `redis://localhost:6379`.

The recommended setup uses Valkey (a Redis-compatible store) via the docker-compose file provided in the [quickstart guide](/guide/standalone/).

## Error messages

Error messages are redacted by default and instead logged to the console. To disable error logging, set `DISABLE_ERROR_LOGGING=true`. To disable error message redaction, set `SHOW_ERRORS=true`.

## Instrumentation challenges

Cap Standalone supports JavaScript instrumentation challenges to defeat proof-of-work solvers, along with options to block headless browsers from solving them. Instrumentation challenges are enabled by default when creating new site keys.

You can toggle instrumentation challenges on or off in your site key config. To block headless browsers, turn on "Attempt to block headless browsers" in the key settings.

## Environment variables

The following environment variables can be used:

- `ENABLE_ASSETS_SERVER` (boolean) to activate [assets](#asset-server).
- `LOCAL_CACHE` or `CACHE_HOST` (string) to set [another local/CDN server](#asset-server).
- `WIDGET_VERSION` and `WASM_VERSION` (string) to set version for those files [in the assets](#asset-server).
- `ADMIN_KEY` (**Compulsory**, string) is the admin dashboard key, we recommend using a 32-character password that can be generated with `openssl rand -base64 32`, must be at least 12 characters long. Can also be hashed.
- `RATELIMIT_IP_HEADER` (string) is the IP Header, would be overwritten by global and local settings.
- `REDIS_URL` (or `VALKEY_URL`) (string) is the url of the redis database.
- `DEMO_MODE` (boolean) set a demo mode for CapJS dashboard. ***Must not be used in production!***
- `SERVER_PORT` (int) set the server port, must match docker ports.
- `SERVER_HOSTNAME` (string) set binding ip for listening to connections.
- `DISABLE_ERROR_LOGGING` (boolean) activates [redaction of error messages](#error-messages).
- `INSTRUMENTATION_MAX_POOL` (int) set maximum number for instrumentation workers.
- `INSTRUMENTATION_MAX_QUEUE` (int) set maximum number for instrumentation queues.
- `RATELIMIT_IP_WARNING` (boolean) activates the warning if rate limit is not configured.