---
description: "Configuration for Cap Standalone, the self-hosted open-source CAPTCHA: environment variables, CORS, rate limiting behind a proxy, the asset server, health checks and challenge protocols."
---

# Configuration

Most settings live in the dashboard, either globally under **Settings** or per site key under its **Configuration** tab. Environment variables cover what has to be known at boot.

## Environment variables

| Variable | Default | What it does |
| --- | --- | --- |
| `ADMIN_KEY` | none | Dashboard password, at least 12 characters. Required. |
| `REDIS_URL` | `redis://localhost:6379` | Redis or Valkey connection string. `VALKEY_URL` also works. |
| `REDIS_PREFIX` | empty | Prefix for every key, for sharing one Redis between deployments. |
| `SERVER_PORT` | `3000` | Port to listen on. |
| `SERVER_HOSTNAME` | `0.0.0.0` | Address to bind to. |
| `CORS_ORIGIN` | `*` | Origins allowed to request challenges, comma-separated. The dashboard setting overrides it. |
| `RATELIMIT_IP_HEADER` | see [below](#client-ips-behind-a-proxy) | Header that carries the client IP. |
| `HIDE_RATELIMIT_IP_WARNING` | `false` | Silences the startup warning when no client IP can be found. |
| `ENABLE_ASSETS_SERVER` | `false` | Serves the widget and WASM files from `/assets`. |
| `WIDGET_VERSION` | `latest` | Widget version the asset server serves. |
| `WASM_VERSION` | `latest` | `@cap.js/wasm` version the asset server serves. |
| `CACHE_HOST` | `https://cdn.jsdelivr.net` | Where the asset server downloads from. |
| `SHOW_ERRORS` | `false` | Returns full error messages instead of redacted ones. |
| `DISABLE_ERROR_LOGGING` | `false` | Stops logging errors to the console. |
| `RSW_BITS` | `2048` | Modulus size for the deprecated RSW protocol. |

## Client IPs behind a proxy

Challenge endpoints are rate-limited per client IP, 30 requests per 5 seconds by default. You can change the limit under **Settings**, or per key in its **Configuration** tab. Over the limit, requests get a `429`. `/siteverify` is meant for your backend and isn't rate-limited.

Standalone reads the client IP from `X-Forwarded-For`, then `X-Real-IP`, then `CF-Connecting-IP`, then the socket address. If your proxy uses another header, set `RATELIMIT_IP_HEADER` or change it under **Settings > Headers**. Behind Cloudflare, use `cf-connecting-ip`.

Your proxy has to forward the IP. With nginx:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Without it, every request comes from the proxy's IP and all visitors share one bucket. Standalone trusts these headers as sent, so don't expose port 3000 directly, or clients can set their own IP and skip the limit.

## Challenge protocol {#hashwx-proof-of-work}

Each site key picks its protocol under **Configuration > Challenge protocol**. The widget detects the protocol on its own, so switching needs no client changes.

- **[HashWX](../hashwx.md)** is the default for new keys. A GPU solves it about twice as fast as a CPU, where SHA-256 gives a GPU around 150 times the speed. **HashWX difficulty** is the expected number of hashes per solve, from `50_000` to `5_000_000`. The default `1_000_000` took a median 578 ms on a desktop and 1.1 to 5.9 s on [phones](../hashwx.md#phones). Browsers without WebAssembly can't solve it.
- **SHA-256** has a pure-JavaScript fallback, so it works without WebAssembly.
- **RSW** is deprecated. A GPU clears about 170 times as many RSW puzzles per second as a CPU, so it doesn't deliver the GPU resistance it was added for. Existing keys keep working.

Keys created before HashWX became the default keep their protocol until you change it.

## Instrumentation

[Instrumentation challenges](../instrumentation.md) are on for new keys. Each key can turn them off, raise the obfuscation level, or block headless browsers with **Attempt to block headless browsers**.

Higher obfuscation levels take longer to generate. Level 3 is the default, and level 1 is faster if generation becomes a bottleneck.

## Asset server

By default the widget loads its script and WASM files from jsDelivr. With `ENABLE_ASSETS_SERVER=true`, Standalone serves them itself:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/hashwx.wasm`

Pin the versions it serves, since `latest` can pick up breaking changes:

```dotenv
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.58
WASM_VERSION=0.0.8
```

The versions are the npm releases of [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) and [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions). `hashwx.wasm` needs `@cap.js/wasm` 0.0.8 or newer, and returns a `503` on older versions.

[Self-hosting the widget](../widget.md#self-hosting-the-widget) shows how to point the widget at these files.

Standalone downloads the files into Redis at startup and refreshes them every hour. If an asset returns `Asset not cached yet`, check that the container can reach `CACHE_HOST`, that the versions exist on npm, and look for `[asset server] failed to update assets cache` in the logs.

## Redis

Standalone keeps all its data in Redis or Valkey. If several deployments share one instance, give each a `REDIS_PREFIX`, for example `cap:`.

## IP data

Country and network lookups use DB-IP Lite, MaxMind GeoLite2 or IPInfo's API, set under **Settings > IP Data**. DB-IP and MaxMind download `.mmdb` files into `/usr/src/app/data`.

The container runs as UID 1000. If you bind-mount a host directory there, it has to be writable by that user, or the download fails with `EACCES`:

```bash
mkdir -p ./cap-data && sudo chown 1000:1000 ./cap-data
```

A named volume avoids the problem, and so does IPInfo, which needs no local files.

## Health checks

- `GET /health` returns `200` when Redis answers within 2 seconds, and `503` otherwise. Use it for readiness checks and alerts.
- `GET /health/live` returns `200` while the process runs, even if Redis is down. Use it for liveness checks, so an orchestrator doesn't restart Cap in a loop during a Redis outage.

In Kubernetes:

```yaml
readinessProbe:
  httpGet: { path: /health, port: 3000 }
livenessProbe:
  httpGet: { path: /health/live, port: 3000 }
```

In Docker Compose:

```yaml
healthcheck:
  test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3
```

On `SIGTERM` or `SIGINT`, Standalone stops accepting connections, finishes requests in flight and exits. It gives up after 8 seconds, inside Docker's default 10-second stop timeout.

## API

Everything the dashboard does is also available over a REST API. The full list of endpoints and request bodies is at `/swagger` on your instance.

Create an API key under **Settings > API keys**. It's shown once, so store it somewhere safe. Send it with every request:

```http
Authorization: Bot <api-key>
```

A key can read and change everything by default. When you create one, you can limit it:

- **Site key access** restricts it to the `/server/keys/:siteKey/...` endpoints of the keys you pick, and `GET /server/keys` lists only those. Every other endpoint returns `403`.
- **Read-only** allows only `GET` requests.

A read-only key scoped to one site key is safe to give to that site's owner, for example to pull their stats into their own dashboard. You can also create scoped keys through the API:

```http
POST /server/settings/apikeys
Content-Type: application/json

{ "name": "acme stats", "siteKeys": ["<site-key>"], "readonly": true }
```
