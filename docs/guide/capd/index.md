---
description: "capd is the easiest way to self-host the open-source CAPTCHA backend: one Docker container with a dashboard, multiple site keys and a reCAPTCHA-compatible API."
---

# capd

capd is the Cap server as a Docker image. It serves challenges to the widget, verifies tokens for your backend, and has a dashboard for site keys, live events, rules, lists and settings. It runs on Bun, idles at about 30 MB of memory, and keeps its data in Valkey, with analytics events in DuckDB or ClickHouse.

<DashboardDemo compact />

To run the whole thing, dashboard included, on Cloudflare without a server, see [Cloudflare Workers](./workers.md). If you only want challenges inside an existing service, the [core library](../capjs-core.md) does that without a dashboard.

## Running it

The [quickstart](../index.md#_1-set-up-capd) downloads a compose file and starts Cap. Cap needs Valkey in every setup, for site keys, settings and sessions, and keeps analytics events in either DuckDB or ClickHouse.

`ADMIN_KEY` is the only value you have to set. It's the dashboard password, and the server refuses to start without one or with one shorter than 12 characters. Everything else is in [Configuration](./options.md).

To update, pull the new image and recreate the containers:

```bash
docker compose pull && docker compose up -d
```

## Analytics storage

DuckDB is a file inside the Cap container, so it needs no extra container. ClickHouse runs as its own container next to Cap and lets several Cap containers share one event history.

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

The DuckDB file runs Cap and Valkey, and Cap writes events to `/usr/src/app/data/events.duckdb` on the `cap-data` volume. DuckDB uses at most 256 MB of memory and 2 threads, which `DUCKDB_MEMORY_LIMIT` and `DUCKDB_THREADS` change. The ClickHouse file runs Cap, Valkey and ClickHouse. ClickHouse uses `ADMIN_KEY` as the password of its `cap` user and isn't published on any port, so there is nothing else to set. Its config turns off ClickHouse's own system log tables and caps it at 1 GB of memory.

| | DuckDB | ClickHouse |
| --- | --- | --- |
| Extra container | No | Yes |
| Memory of the store | Up to 256 MB while the dashboard queries it | About 150 MB idle |
| Several Cap containers | Each keeps its own history | Share one event history |

If your password has spaces, `#` or `$`, wrap it in single quotes in `.env`.

### Your own ClickHouse

Use the DuckDB compose file and add `CLICKHOUSE_URL` to `.env`:

```dotenv
CLICKHOUSE_URL=http://cap:password@clickhouse.internal:8123/cap
```

Cap creates the database and tables on first start. The user needs every privilege on that database and `SELECT` on `system.parts`. If ClickHouse can't be reached at startup, Cap stores events in DuckDB until it restarts and shows the error under **Instance settings > Data and storage**.

### Upgrading from v3

v4 rehashes stored tokens, so your v3 site keys, API keys and dashboard sessions all need a reset on the first start, and a compose file from before analytics needs a `cap-data` volume added for `/usr/src/app/data`. [Migrating from v3 to v4](./migrate-v3-v4.md) walks through every step.

## Putting it online

The widget calls Cap from your visitors' browsers, so the server needs a public HTTPS URL. Put it behind your usual reverse proxy and keep port 3000 closed to the internet.

Cap rate-limits challenges per client IP, which only works if it sees the real IP. Read [client IPs behind a proxy](./options.md#client-ips-behind-a-proxy) before you go live, otherwise every visitor shares one rate-limit bucket.

Live mode on the Events page uses a WebSocket at `/server/live`. Most proxies pass it through as is. With nginx, add `proxy_http_version 1.1` and the `Upgrade` and `Connection` headers to the location for Cap. Without them, the dashboard falls back to checking every 4 s.

## Site keys

Each site key has its own secret, stats and settings: the challenge protocol and difficulty, [instrumentation](../instrumentation.md), rate limits and block rules. New keys use [HashWX](../hashwx.md) with instrumentation on.

You can reveal or copy the secret again under **Add Cap to your site** on the key's **Settings** page, next to a `.env` snippet with both keys. Resetting it is under **Danger zone**. Cap stores it encrypted with a key derived from `ADMIN_KEY`, so a copy of the Valkey data alone doesn't give it away. Changing `ADMIN_KEY` makes stored secrets unreadable, so reset the secret afterwards to get one you can reveal again.

## Endpoints

With a site key `abc123` on `cap.example.com`:

| URL | Called by |
| --- | --- |
| `https://cap.example.com/abc123/` | The widget, as `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | Your backend, with the secret and the token |
| `https://cap.example.com/` | You, for the dashboard |

`/siteverify` takes JSON with `secret` and `response`, like reCAPTCHA's, and returns `{ "success": true }` for a valid token. A failed check returns `success: false` with an `error` message and a 4xx status. Tokens work once.

The dashboard also has a [REST API](./options.md#api) for managing keys from scripts.
