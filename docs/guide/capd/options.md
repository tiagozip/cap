---
description: "Configuration for capd, the self-hosted open-source CAPTCHA: environment variables, client IPs behind a proxy, widget files, health checks and the API."
---

# Configuration

Most settings live in the dashboard, under **Instance settings** for the whole server or on each site key's **Settings** page. This page covers what the dashboard can't set.

## Environment variables

| Variable | What it does |
| --- | --- |
| `ADMIN_KEY` | Dashboard password, at least 12 characters. Required. |
| `VALKEY_URL` | Valkey connection string, `redis://localhost:6379` by default. Redis works too. |
| `VALKEY_TLS_CA` | Path to a CA certificate in PEM format to trust for Valkey over TLS, for a server with a self-signed certificate. Use a `rediss://` URL. `VALKEY_TLS_CERT` and `VALKEY_TLS_KEY` add a client certificate when the server asks for one. |
| `CLICKHOUSE_URL` | Stores events in ClickHouse instead of DuckDB, for example `http://cap:password@clickhouse:8123/cap`. Write the password without URL encoding. |
| `WEBHOOK_ALLOW_PRIVATE` | Set to `true` to let webhooks post to private and loopback addresses, like an n8n on your LAN. |
| `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | Limits for DuckDB, `256MB` and `2` by default. |

`CORS_ORIGIN`, `RATELIMIT_IP_HEADER`, `ENABLE_ASSETS_SERVER`, `WIDGET_VERSION` and `WASM_VERSION` from older releases are now dashboard settings. Cap copies a value that's still set into the dashboard on start.

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
