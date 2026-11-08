---
description: "Run capd on Cloudflare Workers with D1: the same code, dashboard, site keys and siteverify API, with no server or container to run."
---

# Cloudflare Workers

The `workers/` folder in the Cap repository deploys capd to a single Cloudflare Worker. It runs the same code as the Docker image, so it serves the widget routes, `/siteverify`, the API and the dashboard, but it keeps its data and its events in D1 instead of Valkey and DuckDB.

A solve with its siteverify call writes about 15 D1 rows, so the free plan's 100,000 rows a day covers about 6,500 solves a day, and the paid plan's 50 million rows a month covers about 3 million.

## Deploying

You need Node 22 or later, [Bun](https://bun.sh) to build the dashboard, and a Cloudflare account.

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

`npm run deploy` installs capd's packages, builds the dashboard, deploys the Worker and then applies the D1 migrations, because `wrangler deploy` creates the database the first time. `ADMIN_KEY` is the dashboard password. Generate one with `openssl rand -hex 24`.

Open the `workers.dev` URL Wrangler printed and log in. To serve it on your own domain, add a [custom domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) to the Worker.

To update, pull the repository and run the same commands again, except `secret put`.

## How it differs from the Docker image

- **Settings take a few seconds to apply everywhere.** Each isolate reloads settings every 10 s, and caches key config and lists for 5 s and the siteverify CORS origins for 60 s.
- **Redeem is slower.** Every D1 write goes to the database's primary region, and redeem makes several in a row, so visitors far from the primary wait longer.
- **The IP database settings are turned off**, because Cloudflare already gives the Worker each visitor's country and ASN.
- **Obfuscation levels 4 to 10 skip their minify pass**, because esbuild can't run in a Worker. The widget solves the same way.
- **Webhooks retry after 1 s and 5 s.** The third retry, 30 s later, runs past the time Cloudflare gives a Worker after its response, so it usually doesn't happen.
- **Live mode on the Events page checks for new events every 4 s.** The Docker image pushes them over a WebSocket, which a Worker can't fan out without a Durable Object.
- **There are no API docs at `/swagger`.** The Docker image's docs describe the same API.
- **There is no migration from the Docker image's data.** Site keys, settings and events start empty.

D1 runs a database's queries one at a time, so a busy site outgrows the database long before the Worker. Past about 50 solves a second across every site key, use the Docker image.

## Running it locally

```bash
cd workers && npm install
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .dev.vars
npm run dev
```

`npm run dev` builds the dashboard, applies the migrations to a local database and starts `wrangler dev`.
