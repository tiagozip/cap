---
description: "Configuration for capd, the self-hosted open-source CAPTCHA: environment variables, client IPs behind a proxy, widget files, health checks and the API."
---

# Configuration

Most settings live in the dashboard, under **Instance settings** for the whole server or on each site key's **Settings** page. You can also set instance settings from a [config file](#config-file).

## Environment variables

| Variable | What it does |
| --- | --- |
| `ADMIN_KEY` | Dashboard password, at least 12 characters. Required. |
| `VALKEY_URL` | Valkey connection string, `redis://localhost:6379` by default. Redis works too. |
| `VALKEY_TLS_CA` | Path to a CA certificate in PEM format to trust for Valkey over TLS, for a server with a self-signed certificate. Use a `rediss://` URL. `VALKEY_TLS_CERT` and `VALKEY_TLS_KEY` add a client certificate when the server asks for one. |
| `CLICKHOUSE_URL` | Stores events in ClickHouse instead of DuckDB, for example `http://cap:password@clickhouse:8123/cap`. Write the password without URL encoding. |
| `ANALYTICS` | Where Cap keeps analytics: `duckdb`, `clickhouse`, `redis` or `off`. `redis` keeps hourly totals in Valkey and `off` stores nothing, see [totals only or no analytics](./index.md#analytics-off). When unset, Cap uses ClickHouse if `CLICKHOUSE_URL` is set and DuckDB otherwise. |
| `WEBHOOK_ALLOW_PRIVATE` | Set to `true` to let webhooks post to private and loopback addresses, like an n8n on your LAN. |
| `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Limits for DuckDB, `256MB` and `2` by default. |
| `CAP_CONFIG` | Path to a JSON [config file](#config-file) with instance settings. |
| `CAP_CONFIG_JSON` | The same config as inline JSON, for when mounting a file is awkward. Set this or `CAP_CONFIG`, not both. |

## Config file {#config-file}

To set up a new instance the same way every time, put instance settings in a JSON file and point `CAP_CONFIG` at it:

```json
{
  "instance": {
    "headers": { "ipHeader": "X-Forwarded-For" },
    "ratelimit": { "max": 30, "duration": 5000 },
    "cors": { "origins": ["https://example.com"] },
    "filtering": { "blockNonBrowserUA": true, "requiredHeaders": ["accept-language"] },
    "assets": { "enabled": true },
    "analytics": { "retentionDays": 30, "ipMode": "truncate", "logChallenges": true }
  }
}
```

With Docker Compose, mount the file and set the variable in `.env`:

```yaml
services:
  cap:
    volumes:
      - ./cap.config.json:/etc/cap/config.json:ro
```

```sh
CAP_CONFIG=/etc/cap/config.json
```

Cap applies the file every time it starts. Each section you include is read-only in the dashboard and the API, which returns `409` if you try to change it, so the file stays the one place it's set. Sections you leave out stay editable in the dashboard, so you can manage some settings in the file and the rest by hand. A field you leave out of a section gets its default, the same as in the API. If you remove a section from the file, it keeps its last value and becomes editable again.

| Section | Fields | Dashboard |
| --- | --- | --- |
| `headers` | `ipHeader`, `countryHeader`, `asnHeader` | Visitor location > Your proxy or CDN |
| `ratelimit` | `max` (1 to 10,000), `duration` in milliseconds (1,000 to 3,600,000) | Default protection > Challenges per visitor |
| `cors` | `origins`, a list of websites, or `null` to allow any | Default protection > Only allow my websites |
| `filtering` | `blockNonBrowserUA`, `requiredHeaders` | Default protection > Block scripts, Block requests that don't look like a browser |
| `assets` | `enabled`, `widget` and `wasm` versions such as `0.1.58` | Widget files |
| `analytics` | `retentionDays` (1 to 3,650), `ipMode` (`full`, `truncate` or `none`), `logChallenges` | Storage |

Cap won't start if the file has a mistake, such as an unknown section or field or a value out of range, and logs which field is wrong. `GET /server/settings/managed` lists the sections the file sets. Site keys can't be set from the file yet.

When you run several Cap containers, give them all the same file. Each one writes the file's values to Valkey when it starts, so the last container to start wins if the files differ.

## Client IPs behind a proxy

Cap rate-limits challenges per client IP, 30 requests per 5 seconds by default. It uses the socket address and ignores forwarding headers unless you pick your proxy under **Instance settings > Visitor location > Your proxy or CDN**. Behind Cloudflare, pick Cloudflare. For `X-Forwarded-For`, Cap reads the last entry, which is the one your proxy added.

With nginx, forward the address like this:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Without a proxy setting, every visitor shares the proxy's rate-limit bucket. Don't expose port 3000 directly once a header is set, or clients can send any IP they like.

## Signing in through a proxy {#proxy-sign-in}

If the dashboard sits behind Authentik, Authelia, oauth2-proxy or another sign-in proxy, Cap can sign in whoever the proxy lets through, so nobody has to log in a second time with `ADMIN_KEY`. Under **Instance settings > Proxy sign-in**, generate a secret, then have your proxy add it as the `X-Cap-Proxy-Secret` header on the requests it has signed in. With Caddy, that's one line in the `reverse_proxy` block behind your forward auth:

```txt
reverse_proxy localhost:3000 {
    header_up X-Cap-Proxy-Secret {env.CAP_PROXY_SECRET}
}
```

With nginx, it's `proxy_set_header X-Cap-Proxy-Secret $cap_proxy_secret;` in the protected location. The widget routes, `/assets/*`, `/<siteKey>/challenge`, `/<siteKey>/redeem`, `/<siteKey>/siteverify` and `/health`, stay outside your sign-in proxy and don't need the header.

**Proxy or admin key** signs you in automatically when the header is there and keeps the admin key sign-in for everyone else. **Proxy only** turns the admin key sign-in off and checks the header on every dashboard request, so someone you remove in your identity provider loses access at once, even with a session token they kept. API keys keep working in both modes. Cap only switches to proxy only when the request that turns it on carries the header, so you can't lock yourself out from the dashboard.

Cap keeps only a hash of the secret, so generate a new one if you lose it. If a broken proxy locks you out anyway, delete the setting with `docker compose exec valkey valkey-cli DEL settings:proxy-auth`, adding your `REDIS_PREFIX` in front of the key if you set one.

## Widget files {#asset-server}

The widget loads its script and WebAssembly from jsDelivr by default. With **Instance settings > Widget files > Serve widget files from this server** on, Cap downloads them into Valkey and serves them under `/assets/`, and each key's **Add Cap to your site** snippet points there. The same section picks the widget and WASM versions.

## IP data

DB-IP and MaxMind lookups download `.mmdb` files into `/usr/src/app/data`. The container runs as UID 1000, so a bind-mounted folder has to be writable by that user:

```bash
mkdir -p ./cap-data && sudo chown 1000:1000 ./cap-data
```

## Health checks

`GET /health` returns `200` when Valkey answers within 2 seconds and `503` otherwise, so use it for readiness. `GET /health/live` returns `200` while the process runs, so use it for liveness and an orchestrator won't restart Cap during a Valkey outage.

## API

Everything the dashboard does is available over a REST API, documented at `/swagger` on your instance. Create a key under **Instance settings > API keys** and send it as `Authorization: Bot <api-key>`.

A key can do everything by default. You can make it read-only, limit it to some site keys, or both. A read-only key for one site key is safe to hand to that site's owner for their stats.
