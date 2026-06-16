---
description: "Configuration options and environment variables for Cap Standalone, the self-hosted open-source CAPTCHA: CORS, asset server, widget and WASM versions, and more."
---

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

And by setting `window.CAP_CUSTOM_WASM_URL` to the path of the `cap_wasm_bg.wasm` file, like this:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
```

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server.

## Rate-limiting

By default, Standalone will use Elysia's built-in `server.requestIP` function to identify a client's IP for ratelimiting. This might not be correct if you're using something like Cloudflare behind your service.

If so, you can change the IP extraction logic to simply read from a header set in `RATELIMIT_IP_HEADER` in your env. For example, if you were using Cloudflare, you might set `RATELIMIT_IP_HEADER` to `cf-connecting-ip`. On most setups, this is `x-forwarded-for`.

The `/siteverify` endpoint is intended for server-to-server use, so it's not ratelimited by default.

## Redis / Valkey

Cap Standalone uses Redis (or Valkey) for all data storage. Set the `REDIS_URL` environment variable to your Redis connection string. This defaults to `redis://localhost:6379`.

The recommended setup uses Valkey (a Redis-compatible store) via the docker-compose file provided in the [quickstart guide](/guide/standalone/).

### Connection string

`REDIS_URL` (or `VALKEY_URL`) accepts the standard formats:

```
redis://localhost:6379                  # plain
redis://localhost:6379/0                # with database number
redis://user:password@localhost:6379    # with authentication
rediss://user:password@host:6379        # TLS (note the double "s")
```

### Key prefix

If you share a single Redis instance across multiple Cap deployments (or with other apps), set `REDIS_PREFIX` to namespace all keys. For example, `REDIS_PREFIX=cap:` stores sessions as `cap:session:...`, metrics as `cap:metrics:...`, and so on:

```
REDIS_PREFIX=cap:
```

It's **empty by default**, and this matters:

- **New deployment:** setting `REDIS_PREFIX=cap:` from the start is a good convention, especially on a shared instance.
- **Existing deployment:** do **not** add a prefix to a running instance without migrating. Cap would start looking for `cap:key:...` while your data lives under `key:...`, making every existing site, session and metric invisible (it looks like data loss). Rename the keys first, or only introduce a prefix on a fresh instance.

The prefix is applied transparently to every command; it has no effect on cluster routing (it is included consistently in the slot calculation).

### High availability (Redis Cluster)

For high availability, Cap Standalone can connect to a Redis/Valkey Cluster. Set `REDIS_CLUSTER=true` and point `REDIS_URL` at one or more seed nodes (comma-separated):

```
REDIS_CLUSTER=true
REDIS_URL=redis://node-1:6379,redis://node-2:6379,redis://node-3:6379
```

You only need to list a couple of reachable seed nodes; the client discovers the full topology from them and keeps it refreshed. The prefix, authentication and TLS work the same way in both modes — for an authenticated TLS cluster:

```
REDIS_CLUSTER=true
REDIS_URL=rediss://user:password@node-1:6379,rediss://user:password@node-2:6379
REDIS_PREFIX=cap:
```

When `REDIS_CLUSTER` is unset (the default), Cap connects to a single Redis/Valkey instance exactly as before.

#### How it behaves

- **Routing:** every command is sent to the master owning its key's slot. Reads and writes both go to masters (no stale reads from replicas), which is what Cap's counters, nonces and tokens require.
- **Node failure:** if a master goes down, the client detects it, retries, and reroutes to the promoted replica once the cluster elects one — automatically, no application code involved. During the election window (driven by `cluster-node-timeout` plus election time, typically a few seconds), requests whose keys live on the affected shard may be slower or fail with an error; they never return an incorrect verification. Other shards keep serving.
- **Replicas are required:** failover only works if each master has at least one replica to promote.

#### Local testing

A single-node cluster compose file is provided at `standalone/docker-compose.cluster.yml`:

```sh
docker compose -f docker-compose.cluster.yml up -d
```

It exercises the cluster code path (topology discovery, slot routing) with one master owning all 16384 slots. It is for **testing only** — a single node has no replica, so it provides **no failover**. Real high availability requires at least 3 masters and 3 replicas, or a managed Valkey/Redis cluster, with `REDIS_URL` pointing at the seed nodes.

#### Notes and limitations

- Redis **Sentinel** is not supported; use Cluster mode for HA.
- All of Cap's commands operate on a single key, so they route cleanly across cluster slots (no `CROSSSLOT` errors).

## Error messages

Error messages are redacted by default and instead logged to the console. To disable error logging, set `DISABLE_ERROR_LOGGING=true`. To disable error message redaction, set `SHOW_ERRORS=true`.

## RSW time-lock puzzles

Standalone supports the [RSW time-lock puzzle](../rsw.md) as an opt-in, GPU-resistant alternative to SHA-256 PoW. It's configured per site key, so individual keys can use RSW while others stay on the default SHA-256 challenges.

To enable it, open a key's **Configuration** tab and switch the **Challenge protocol** to "RSW time-lock puzzle". The first time you enable RSW on any key, Standalone generates a 2048-bit modulus (~1-3 seconds) and stores it in Redis. The same keypair is reused for all RSW-enabled keys; you don't need to manage it manually.

Difficulty is controlled by the **RSW squarings** slider (the `t` parameter — the number of sequential squarings the client must compute). Defaults to `75_000`, which is roughly 300-800ms of client-side work on modern hardware. Lower it for cheaper challenges, raise it for stronger throttling. The valid range is `10_000`-`300_000`.

You can override the modulus size at boot with `RSW_BITS=2048` (default). Smaller sizes are useful only for testing.

::: tip
RSW is opt-in and currently experimental. The default Cap pipeline still uses SHA-256 PoW. The widget auto-detects RSW challenges from the wire format, so flipping the toggle is the only change you need to make.
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
