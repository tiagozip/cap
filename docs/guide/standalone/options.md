---
description: "Configuration options and environment variables for Cap Standalone, the self-hosted open-source CAPTCHA: CORS, asset server, widget and WASM versions, and more."
---

# Options

## CORS

You can change the default CORS settings for redeeming and generating challenges by setting the `CORS_ORIGIN` environment variable when running the server. This defaults to `*`, which allows all origins. You can add multiple origins by separating them with commas, like `domain1.tld,domain2.tld,...`.

## Asset server

The asset server is disabled by default. You can enable it by setting the `ENABLE_ASSETS_SERVER` environment variable to `true`. This will serve the assets from the `/assets` endpoint.

Then, make sure to set `WIDGET_VERSION` and `WASM_VERSION` to the correct version of the widget and WASM files you want to serve. This defaults to `latest`, which will serve the latest version of the widget and WASM files, although these are not recommended in production as they might serve breaking changes.

The available versions are the published npm releases of [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) and [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions). For example:

```env
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.58
WASM_VERSION=0.0.8
```

Your assets will be served from the following paths:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/hashwx.wasm`
- `/assets/cap_wasm.js`

You can use these in your app by setting the widget's script source to the appropriate path, like this:

```html
<script src="https://<server url>/assets/widget.js"></script>
```

For the floating mode, use:

```html
<script src="https://<server url>/assets/floating.js"></script>
```

And by setting `window.CAP_CUSTOM_WASM_URL` and `window.CAP_CUSTOM_HASHWX_URL` to the paths of the `cap_wasm_bg.wasm` and `hashwx.wasm` files, like this:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
window.CAP_CUSTOM_HASHWX_URL = "https://<server url>/assets/hashwx.wasm";
```

`hashwx.wasm` ships in `@cap.js/wasm` 0.0.8 and newer. With an older `WASM_VERSION`, `/assets/hashwx.wasm` responds with a 503, so leave `CAP_CUSTOM_HASHWX_URL` unset and the widget will load it from jsdelivr.

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server.

### Troubleshooting

The assets are downloaded from `CACHE_HOST` into Redis at startup, then refreshed hourly. If an asset endpoint responds with `Asset not cached yet`, the download hasn't happened. Check that:

- `ENABLE_ASSETS_SERVER=true` is actually set on the Cap container. If you changed it in a compose file, recreate the container. When it isn't set, the `/assets/*` endpoints respond with a 404 explaining that the asset server is disabled.
- The container has outbound network access to `CACHE_HOST`. If a download fails, the server logs a line containing `[asset server] failed to update assets cache` at startup and retries every hour.
- `WIDGET_VERSION` and `WASM_VERSION` point to versions that actually exist on npm.

## Rate-limiting

Challenge endpoints are rate-limited per client IP using a fixed window, defaulting to 30 requests every 5 seconds. You can change the global limit under **Settings** in the dashboard (or via `PUT /settings/ratelimit`), and override it per site key in the key's **Configuration** tab. When the limit is exceeded, requests get a `429` response with an `X-RateLimit-Remaining: 0` header.

The `/siteverify` endpoint is intended for server-to-server use, so it's not ratelimited by default.

### Client IPs behind a proxy

Standalone identifies clients by checking the `X-Forwarded-For`, `X-Real-IP` and `CF-Connecting-IP` headers (in that order), falling back to the socket address. If you're behind a reverse proxy that uses a different header, set `RATELIMIT_IP_HEADER` in your env (or the IP header under **Settings > Headers** in the dashboard). For example, behind Cloudflare you might set it to `cf-connecting-ip`.

Make sure your proxy actually forwards the client IP. For nginx:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Without this, every request appears to come from the proxy's own IP and all clients share a single rate-limit bucket. Also note that `X-Forwarded-For` is trusted as-is, so the server must not be directly reachable from the internet, otherwise clients can spoof the header and bypass rate limiting.

## Redis / Valkey

Cap Standalone uses Redis (or Valkey) for all data storage. Set the `REDIS_URL` environment variable to your Redis connection string. This defaults to `redis://localhost:6379`.

The recommended setup uses Valkey (a Redis-compatible store) via the docker-compose file provided in the [quickstart guide](/guide/standalone/).

If you share a single Redis instance across multiple Cap deployments (or with other apps), set `REDIS_PREFIX` to namespace all keys. For example, `REDIS_PREFIX=cap:` stores sessions as `cap:session:...`, metrics as `cap:metrics:...`, and so on. It's empty by default, so existing deployments are unaffected.

## Error messages

Error messages are redacted by default and instead logged to the console. To disable error logging, set `DISABLE_ERROR_LOGGING=true`. To disable error message redaction, set `SHOW_ERRORS=true`.

## HashWX proof of work

Standalone uses [HashWX](../hashwx.md), a GPU-resistant proof of work, as the default challenge protocol for new keys. It's configured per site key, so individual keys can use SHA-256 while others stay on HashWX. Keys created before HashWX became the default keep whatever they were on until you change them.

To change the protocol, open a key's **Configuration** tab and pick one under **Challenge protocol**. HashWX needs no setup: there's no keypair to generate or persist.

Difficulty is controlled by the **HashWX difficulty** slider, the expected number of hashes a client must compute. It defaults to `1_000_000`, split into four sub-challenges, which measured a 578 ms median on an 8-core desktop in Chrome and 1.1 to 5.9 s on phones. See [the phone measurements](../hashwx.md#phones) before you raise it. The valid range is `50_000`-`5_000_000`.

Clients without WebAssembly cannot solve HashWX. If you need to support them, put that key on SHA-256 proof of work instead, which has a pure-JS fallback.

RSW time-lock puzzles are still selectable for existing deployments, but they are deprecated: a GPU clears about 170 times as many of them per second as a CPU, so they do not deliver the GPU resistance they were added for. The **RSW difficulty** slider sets `t`, the number of sequential squarings, in the range `10_000`-`300_000`, and `RSW_BITS=2048` overrides the modulus size at boot.

::: tip
The widget auto-detects the protocol from the wire format, so switching a key is the only change you need to make. Outside Standalone, cap-core still defaults to SHA-256 PoW unless you opt in.
:::

## Instrumentation challenges

Cap Standalone supports JavaScript instrumentation challenges to defeat proof-of-work solvers, along with options to block headless browsers from solving them. Instrumentation challenges are enabled by default when creating new site keys.

You can toggle instrumentation challenges on or off in your site key config. To block headless browsers, turn on "Attempt to block headless browsers" in the key settings.

Note that high instrumentation levels can significantly reduce generation throughput. We recommend keeping it at level 3 unless you need stronger obfuscation. If you find level 3 is too slow, level 1 is significantly faster on a single core.

## IP database

Country and ASN lookups can use one of three providers, configured under `Settings > IP Data > Country & ASN data` in the dashboard: DB-IP Lite, MaxMind GeoLite2 and IPInfo's API.

For DB-IP and MaxMind, the `.mmdb` files are downloaded into `/usr/src/app/data/` inside the container.

### Docker volume permissions

The container runs as the unprivileged `bun` user (UID 1000). If you bind-mount a host directory onto `/usr/src/app/data`, the host directory must be writable by UID 1000, otherwise the download will fail with `EACCES: permission denied`.

```bash
mkdir -p ./cap-data
sudo chown 1000:1000 ./cap-data
```

```yaml
services:
  cap:
    image: tiago2/cap:latest
    volumes:
      - ./cap-data:/usr/src/app/data
    # ...
```

If you can't change ownership on your host (some platforms like Coolify make this awkward), the simplest alternatives are:

- Skip the bind mount entirely and let Docker manage the data directory — the image already creates it with the correct ownership.
- Use a named volume instead of a bind mount.
- Switch to an IP Data provider that doesn't require any local files.
