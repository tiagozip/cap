# Add Cap to this project

You are adding **Cap**, a self-hosted, open-source CAPTCHA, to the user's codebase, or replacing the CAPTCHA it already has. This guide tells you what Cap is, where it belongs, which deployment and widget mode to pick, and exactly how to wire it up and prove that it works.

Work through it in order. The user's stack, router, form handling and secret storage are the source of truth, so confirm every assumption against the codebase before you write code. If this guide doesn't answer a question, read the docs at https://trycap.dev/llms-full.txt, or clone https://github.com/tiagozip/cap into a temporary directory and read the code. Don't invent option names, endpoints, benchmarks or adoption numbers.

If the user only asks you to evaluate Cap, stop after the summary below, make the case for or against it with the facts in https://trycap.dev/agent.md, and ask whether they want it implemented.

---

## What Cap is

Every solve runs two independent checks:

1. **Proof of work.** The browser solves a puzzle in Web Workers with WebAssembly. HashWX is the default. It generates a new hash function for every block of nonces, so a GPU solves it about 2x faster than a CPU instead of 150x with SHA-256. SHA-256 is still available and has a JavaScript fallback. The RSW time-lock protocol is deprecated, so don't use it.
2. **Instrumentation.** The server generates a new JavaScript program for every challenge. It runs in a sandboxed iframe, hashes what it observes in the page into its answer, and the server recomputes that answer.

Per site key, you can also turn on headless browser blocking, interaction detection, behavior scoring and AI agent detection. Step 5 lists them with their API fields.

The visitor sees a checkbox, or nothing in invisible mode. At the default difficulty a solve takes about 0.5 s in desktop Chrome, 0.7 s in Safari, and a median of 1.1 to 2.4 s on the phones Cap was tested on. The widget starts working before the click, so most of that time is hidden.

Cap protects actions, not pageviews. Visitors browse normally, and verification happens where abuse costs the user money.

The parts:

- **Widget.** The `<cap-widget>` web component, published on npm as `cap-widget`, about 20 KB gzipped.
- **capd.** The Cap server, Docker image `tiago2/cap:4`. It issues challenges, verifies tokens, and has a dashboard with analytics, rules, lists, webhooks, a REST API and an MCP server.
- **capd on Cloudflare Workers.** The same server as one Worker with D1. Experimental.
- **capjs-core.** A stateless JavaScript library that issues and validates challenges inside the user's own backend.

---

## Step 1: Audit the codebase

Search for existing bot protection before you change anything:

- reCAPTCHA: `recaptcha`, `grecaptcha`, `g-recaptcha`, `g-recaptcha-response`, `RECAPTCHA_`, `react-google-recaptcha`, `vue-recaptcha`
- hCaptcha: `hcaptcha`, `h-captcha`, `h-captcha-response`, `HCAPTCHA_`, `@hcaptcha/`
- Turnstile: `turnstile`, `cf-turnstile`, `cf-turnstile-response`, `TURNSTILE_`, `challenges.cloudflare.com`
- Others: `altcha`, `friendly-challenge`, `frc-captcha`, `mtcaptcha`, `arkose`, `funcaptcha`, `geetest`
- An older Cap integration: `cap-widget`, `@cap.js/widget`, `@cap.js/server`, `capjs-core`, `cap-token`

For every hit, note the frontend mount, the field that carries the token, the backend verification call, the environment variables, the content security policy, and any tests or mocks.

Then list the endpoints worth protecting: route handlers, server actions, API routes and form posts.

### If there is no CAPTCHA

Protect the endpoints where abuse turns into cost, in this order:

1. **Sign up**, against fake accounts.
2. **Sign in**, against credential stuffing and brute force.
3. **Password reset, magic link and one-time code sends**, because each one sends an email or SMS that someone pays for.
4. **Contact, support and feedback forms**, against spam.
5. **Public write endpoints**, like comments, reviews, votes and uploads.
6. **Expensive unauthenticated routes**, like search, AI and LLM calls, report generation, and anything that calls a paid API.

Leave Cap off authenticated routes where a session already proves the user, read-only pages, health checks, webhooks from known services, and admin routes behind a VPN or SSO. Rate limits alone don't replace a CAPTCHA, but they combine well with one, for example by requiring a solve only after a client sends too many requests.

Decide whether each route needs one solve per request, or one solve that unlocks a session for a number of requests. A signup form needs one per request. A chat endpoint that calls an LLM usually works better with one solve per session.

Propose the list to the user and get agreement before you implement it. If they want to start small, start with signup and password reset.

### If a CAPTCHA already exists

Replace it on the same endpoints. Whoever added it already decided where protection matters. Remove the old script tags, packages, verification calls, environment variables, CSP entries, tests and mocks once the replacement works, and tell the user which secrets they can revoke. Step 10 has the mapping for each provider.

---

## Step 2: Choose a deployment

Pick one before writing code, and tell the user which one you picked and why.

| | capd with Docker | capd on Cloudflare Workers | capjs-core |
| --- | --- | --- | --- |
| What it is | A server you deploy next to Valkey | One Worker with a D1 database | A library inside the user's backend |
| Dashboard, analytics, rules, lists, webhooks, API, MCP | Yes | Yes, with the differences listed in step 3 | No |
| Token storage and replay protection | Built in | Built in | You write it |
| Rate limiting | Built in, 30 challenges per 5 s per IP by default | Built in | You write it |
| Runtime | Any Docker host, or Railway | Cloudflare | Any JavaScript runtime, including Workers, Lambda and Vercel functions |
| Status | Stable | Experimental, best under about 50 solves a second across all keys | Stable |

Recommend **capd with Docker** when the project has a server, a Docker host or a Kubernetes cluster, or when the user wants analytics, rules or a dashboard. This fits most projects.

Recommend **capd on Workers** when the project already runs on Cloudflare, the user wants the dashboard, and there's no container host.

Recommend **capjs-core** when the backend is JavaScript and any of these is true:

- The app is fully serverless outside Cloudflare, for example on Lambda or Vercel functions.
- A second service is too much for the project.
- Challenges should live inside an existing service.
- The user doesn't want analytics and wants the fewest moving parts.

capjs-core is JavaScript only. For a Python, Go, PHP, Java or .NET backend, use capd. Its `/siteverify` is one HTTP call from any language.

Lead with your recommendation and present the alternative without running it down. For example:

> I'd go with capjs-core, since the app runs on Vercel functions and doesn't need a dashboard. capd is the other option if you want analytics and rules later. I'll use your Postgres database for replay protection and token storage.

If the user picks capd, do steps 3 to 6 and then 8 onward. If they pick capjs-core, skip to step 6, then do 7 onward.

---

## Step 3: Deploy capd

Ask the user where to host it. Don't assume. Prefer wherever the project already runs.

### Docker Compose

Pick an analytics store first. DuckDB is a file inside the Cap container and fits most sites. ClickHouse runs as a third container and lets more than one Cap container share an event history.

DuckDB, which runs Cap and Valkey:

```bash
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

ClickHouse, which runs Cap, Valkey and ClickHouse:

```bash
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

The dashboard is then at `http://localhost:3000`. DuckDB data lives in `/usr/src/app/data/events.duckdb` on the `cap-data` volume. The ClickHouse file uses `ADMIN_KEY` as ClickHouse's password and doesn't publish its port.

Environment variables:

| Variable | Default | What it does |
| --- | --- | --- |
| `ADMIN_KEY` | none | Required. Dashboard password, at least 12 characters. It also encrypts stored site secrets, so changing it makes them unrevealable until you reset them. |
| `VALKEY_URL` | `redis://localhost:6379` | Valkey connection string. Redis works too. Use `rediss://` for TLS, with `VALKEY_TLS_CA`, `VALKEY_TLS_CERT` and `VALKEY_TLS_KEY` as needed. |
| `CLICKHOUSE_URL` | unset | Stores events in ClickHouse, for example `http://cap:password@clickhouse:8123/cap`. |
| `ANALYTICS` | DuckDB, or ClickHouse when `CLICKHOUSE_URL` is set | `duckdb`, `clickhouse`, `redis` for hourly totals in Valkey that every Cap container shares, or `off`. Verification, rules and webhooks work in every mode. |
| `DUCKDB_MEMORY_LIMIT`, `DUCKDB_THREADS` | `256MB`, `2` | DuckDB limits. |
| `WEBHOOK_ALLOW_PRIVATE` | unset | `true` lets webhooks post to private and loopback addresses. |
| `CAP_UPDATE_CHECK` | on | `0` turns off the daily update check. |
| `CAP_SETTINGS_FILE` | unset | Path to a settings file that capd applies at every start. |

Before you call it done:

- **Put it behind HTTPS on a public URL.** The widget calls capd from visitors' browsers, so `localhost` only works in development.
- **Set the client IP source.** capd rate-limits per IP and ignores forwarding headers until the user picks their proxy under **Instance settings > Visitor location > Your proxy or CDN**. There are presets for Cloudflare, Vercel and nginx. Without it, every visitor shares the proxy's rate-limit bucket. With it set, keep port 3000 closed to the internet, or clients can forge their IP.
- **Pass WebSockets through** for live events at `/server/live`. With nginx, add `proxy_http_version 1.1` and the `Upgrade` and `Connection` headers. Without them the dashboard polls every 4 s.
- **Use `GET /health` for readiness and `GET /health/live` for liveness.**

To update: `docker compose pull && docker compose up -d`. An instance still on v3 must follow https://trycap.dev/guide/capd/migrate-v3-v4 first, because v4 resets secrets, API keys and sessions and needs the `cap-data` volume.

To configure a server from code instead of the dashboard, export a settings file from **Instance settings > Backup > Settings file**, mount it and set `CAP_SETTINGS_FILE`. It can hold `ratelimit`, `cors`, `filtering`, `headers`, `analytics`, `assets` and `updateCheck`. Site keys, API keys, rules and lists aren't part of it. The file wins on every restart, and a typo stops capd from starting with a message naming the field.

```json
{
  "cap": "settings",
  "version": 1,
  "settings": {
    "headers": { "ipHeader": "CF-Connecting-IP", "countryHeader": "CF-IPCountry" },
    "analytics": { "retentionDays": 365, "anonymizeDays": 60, "ipMode": "full" },
    "updateCheck": { "enabled": true, "interval": "weekly" }
  }
}
```

### Cloudflare Workers

Needs Node 22 or later, Bun to build the dashboard, and a Cloudflare account.

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

Differences from Docker: settings take up to 10 s to reach every isolate, redeem is slower for visitors far from D1's primary region, the IP database settings are off because Cloudflare supplies country and ASN, the third webhook retry usually doesn't run, live events poll every 4 s, there's no `/swagger`, event exports stop at 20,000 rows, and there's no import from a Docker instance. Details: https://trycap.dev/guide/capd/workers

### Railway

For a user with no server who wants a one-click deploy, https://trycap.dev/railway deploys Cap with Valkey. Railway is a paid host, so say so. Generate a long random `ADMIN_KEY` for them to paste, and ask them to send back the public URL Railway assigns.

---

## Step 4: Get the credentials

capd has three credentials. Mixing them up is the most common setup failure.

| Credential | Looks like | Used by | Goes to the browser? |
| --- | --- | --- | --- |
| Admin key | whatever `ADMIN_KEY` is | dashboard sign-in | No |
| Site key | 10 hex characters, like `a1b2c3d4e5` | the widget's endpoint | Yes, it's public |
| Secret key | starts with `sk-` | the backend's `/siteverify` call | Never |

You can't read the user's dashboard, so ask:

> I need a site key and its secret. Open your Cap dashboard at `https://<instance>/`, sign in with your `ADMIN_KEY`, open the key menu at the top of the sidebar, click **Create site key**, name it after this project, and paste both values here.
>
> You can copy the secret again later under **Add Cap to your site** on the key's **Settings** page, which also has a `.env` snippet with `CAP_SITE_KEY` and `CAP_SECRET`.

If your environment can add MCP servers, the user can connect capd instead, and you create the key yourself. The server is at `https://<instance>/mcp` and signs in with OAuth, where the user picks full or read-only access and which site keys you can touch:

```bash
claude mcp add --transport http capd https://<instance>/mcp
codex mcp add capd --url https://<instance>/mcp
```

Its tools mirror the API, for example `list_site_keys`, `create_site_key`, `update_site_key`, `get_secret_key`, `get_rules`, `set_rules`, `preview_rules`, `search_events` and `get_analytics`. Ask the user before you delete anything or rotate a secret.

Without MCP, ask for an API key from **API and MCP** in the dashboard and call the REST API with `Authorization: Bot <apiKey>`:

```bash
curl -X POST https://<instance>/server/keys \
  -H "Authorization: Bot <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project"}'
```

The response is `{ "siteKey": "a1b2c3d4e5", "secretKey": "sk-..." }`. The body also accepts `instrumentation`, `blockAutomatedBrowsers`, `detectAutomatedInteractions`, `blockAutomatedInteractions`, `behavior`, `blockAgents`, `allowVerifiedAgents`, `corsOrigins`, `protocol`, `hashwxDifficulty` and `sha256Fallback`. `GET /server/keys/:siteKey/secret` returns the secret again. `GET /server/api-docs` returns Markdown docs for every endpoint, and `/swagger` has the interactive version on Docker.

Store the secret the way the project stores other server secrets, such as `.env` with `.gitignore` or the platform's secret store. Never hardcode it, never put it in client code, never commit it. The site key is public.

Use separate site keys for production and staging, so test traffic doesn't land in production stats or rules.

---

## Step 5: Configure the site key

New keys use HashWX at difficulty 1,000,000 with instrumentation on, and everything else off. The key's **Settings** page has three presets:

| Preset | HashWX difficulty | What else it turns on |
| --- | --- | --- |
| Relaxed | 500,000 | SHA-256 fallback for browsers without WebAssembly |
| Balanced | 1,000,000 | Behavior scoring in report mode |
| Strict | 3,000,000 | Headless browser blocking, automated click and typing blocking, behavior blocking |

Recommendations:

- **Most forms:** Balanced. It reports suspicious behavior without blocking, so the user can watch the Events page before tightening anything.
- **Mostly phone visitors:** Relaxed, or difficulty 500,000, which roughly halves solve time.
- **Signup or login under active abuse:** Strict, or Balanced plus a `harder` rule for fast repeat visitors.
- **Visitors with Safari Lockdown Mode or a CSP without `'wasm-unsafe-eval'`:** turn on "Allow SHA-256 when WebAssembly is off", API field `sha256Fallback`. Any client can ask for the fallback, so leave it off otherwise.
- **Restrict origins:** turn on **Access > Only allow these websites**, API field `corsOrigins`, and list every origin the widget runs on, staging and local development included.

The detection settings, with their API field names:

| Setting | Field | Values | Default |
| --- | --- | --- | --- |
| Instrumentation | `instrumentation` | boolean | `true` |
| Attempt to block headless browsers | `blockAutomatedBrowsers` | boolean | `false` |
| Detect automated clicks and typing | `detectAutomatedInteractions` | boolean | `false` |
| Block automated clicks and typing | `blockAutomatedInteractions` | boolean | `false` |
| Behavior scoring | `behavior` | `off`, `report`, `block` | `off` |
| Behavior threshold | `behaviorThreshold` | 0.1 to 1, or `null` for 0.75 | `null` |
| Require a press on the widget | `requireInteraction` | boolean | `false` |
| AI agents | `blockAgents` | `off`, `identified`, `all` | `off` |
| Let verified agents through | `allowVerifiedAgents` | boolean | `false` |
| Per-agent actions | `agentActions` | `{ "<agent>": "allow" or "report" or "block" }` | `{}` |
| Per-flag actions | `signalActions` | `{ "<flag>": "off" or "report" or "block" }` | `{}` |
| Protocol | `protocol` | `hashwx`, `sha256-pow` | `hashwx` |
| HashWX difficulty | `hashwxDifficulty` | 50,000 to 5,000,000 | 1,000,000 |
| SHA-256 difficulty and count | `difficulty`, `challengeCount` | 1 to 8, 1 to 500 | 4, 80 |
| Obfuscation level | `obfuscationLevel` | 1 to 10 | 5 |
| Rate limit override | `ratelimitMax`, `ratelimitDuration` | 1 to 10,000 requests per 1,000 to 3,600,000 ms | instance default |

Change them with `PUT /server/keys/:siteKey/config`, passing only the fields to change.

### Rules

Rules run on every challenge and redeem. A key can have up to 100, each with up to 12 conditions.

- Conditions on the request: `ip`, `country`, `asn`, `asn_org`, `ua`, `browser`, `os`, `platform`, `origin`, `lang`, `visitor`, `header`, `list`, `ip_velocity` and `visitor_velocity`, which count challenges in the last minute.
- Conditions on the result: `score`, `verdict`, `agent`, `agent_confidence`, `agent_verified`, `flag` and `solve_ms`.
- Actions: `block`, `allow`, `flag` and `harder`. `harder` multiplies the difficulty by 1.5x to 10x for matching requests, 2x if no factor is set.
- Regular expressions use RE2, without backreferences or lookarounds.

Recommended starting rule: the **Harder puzzles for fast repeat visitors** template, which gives a 4x puzzle to IPs that ask for more than 20 challenges a minute. Use `POST /server/keys/:siteKey/rules/preview`, or the `preview_rules` MCP tool, to test a rule against past events before you save it.

Shared lists under **Instance settings** hold IPs, CIDR ranges, ASNs, network names, countries, user agents and visitor IDs, up to 100,000 entries each, and any key's rules can reference them.

### Webhooks

Up to 10 per key, triggered by `block`, `fail`, `flagged`, `agent`, `rule` or `all`. Each delivery is a JSON POST with a `cap-webhook-id` header and a `cap-signature: t=<unix seconds>,v1=<hex>` header. Verify it by computing HMAC-SHA256 of `<t>.<raw body>` with the webhook's secret and comparing it to `v1`. Failed deliveries retry after 1 s, 5 s and 30 s. Webhooks to private addresses are refused unless `WEBHOOK_ALLOW_PRIVATE=true`.

### Data retention

Under **Instance settings > Data and storage**:

- **Keep events for:** forever by default. Settings file and API field `retentionDays`, 0 for forever, up to 3,650.
- **Anonymize IP addresses after:** 60 days by default. Older events keep only the /24 or /48. Field `anonymizeDays`, 0 for never.
- **Visitor IP addresses:** `full`, `truncate` or `none` in the `ipMode` field. `full` is needed to block or look up single visitors.
- **Record every challenge shown:** on by default. Field `logChallenges`. Turning it off keeps only solves, blocks and rate limits, about a third fewer events.

If the user has a privacy policy with a retention period, set `retentionDays` to match it. Ask before you change these, since they affect what the user can investigate later.

---

## Step 6: Detection details that affect your integration

- **Invisible and floating solves have no press on the widget.** On a capd key, they still pass behavior blocking while `requireInteraction` is `false`, which is the default. With `requireInteraction: true` they fail with `behavior_no_interaction`. In capjs-core, `requireInteraction` defaults to `true`, so set it to `false` on routes that use invisible or floating mode.
- **Old widgets** solve with the `legacy_widget` risk flag and fail with `instr_widget_outdated` on keys that block automated interactions, block on behavior or block agents. Pin a current widget version.
- **Headless blocking blocks your own headless tests.** Run end-to-end tests against a separate key without it, or with a real browser.
- **AI agents** add `agent:<name>` to `riskFlags`. Blocking them also blocks users who let an agent fill a form for them, so ask the user before turning it on.

---

## Step 7: Set up capjs-core

Skip this step for capd.

With capjs-core there is no server to deploy, no dashboard and no site keys. The app exposes two routes and holds one signing secret.

```bash
npm install capjs-core
```

Generate a secret of at least 16 random bytes, store it like any server secret, and use the same value in every process:

```
CAP_SECRET=<32 random bytes, hex or base64>
```

The widget POSTs to `<prefix>challenge` and then `<prefix>redeem`. With the endpoint `/cap/`, expose `POST /cap/challenge` and `POST /cap/redeem`:

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

export async function challenge() {
  return await generateChallenge(SECRET, {
    format: 2,
    protocols: ["hashwx", "instrumentation"],
    scope: "signup",
  });
}

export async function redeem(body) {
  const result = await validateChallenge(SECRET, body, {
    scope: "signup",
    consumeNonce: async (sig, ttlMs) =>
      (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK",
  });
  if (!result.success) return { success: false, reason: result.reason };
  await redis.set(`cap-token:${result.tokenKey}`, String(result.expires), "PX", result.expires - Date.now());
  return { success: true, token: result.token, expires: result.expires };
}
```

`generateChallenge` issues HashWX by default. Passing `challengeCount`, `challengeSize` or `challengeDifficulty` without `format`, or `format: 1`, switches to SHA-256. Pass the whole redeem body to `validateChallenge`. HashWX needs widget 0.1.58 or later.

Then verify the token on the protected route. The token is `id:secret`, and the stored key is `id:` plus the SHA-256 hex of the secret part:

```js
import { createHash } from "node:crypto";

const [id, secret] = String(req.body["cap-token"] ?? "").split(":");
if (!id || !secret) return reject();
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await redis.getdel(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) return reject();
```

Rules:

1. **`consumeNonce` must be atomic** and return `false` the second time it sees a signature. Redis `SET NX`, a unique database constraint or a Durable Object all work. Workers KV isn't atomic, so two concurrent requests can both pass.
2. **Delete the token when you read it.** Reading without deleting makes it replayable until it expires.
3. **Use the same `scope`** in `generateChallenge` and `validateChallenge`, or every solve fails with `scope_mismatch`.
4. **Keep `CAP_SECRET` out of client bundles.** With it, anyone can mint their own challenges.

Useful options: `expiresMs` for the challenge, default 600,000; `tokenTtlMs` for the token, default 1,200,000; `hashwxDifficulty`, default 1,000,000; `instrumentation: { blockAutomatedBrowsers: true }`; and `behavior: { block: true, blockAgents: "identified", requireInteraction: false }`. A successful result has `riskFlags`, and `behavior` or `agent` when there's evidence, so the app can raise `hashwxDifficulty` for visitors it doesn't trust.

On runtimes that can't compile WebAssembly at runtime, other than Cloudflare Workers, import `capjs-core/hashwx.wasm` and pass it to `setHashwxModule` before the first verification.

Full reference: https://trycap.dev/guide/capjs-core

---

## Step 8: Add the widget

### Pick a mode

| Mode | What the visitor sees | Use it for |
| --- | --- | --- |
| Standard | A checkbox in the form | Signup, login, contact and checkout forms. The default choice. |
| Floating | Nothing until they press the protected button, then a checkbox next to it that solves and presses the button again | Forms where a visible checkbox doesn't fit the design |
| Invisible | Nothing | Actions without a form, like a like button, a fetch call or an LLM request |

When replacing reCAPTCHA v2 or a visible hCaptcha or Turnstile widget, use standard mode. When replacing reCAPTCHA v3, invisible hCaptcha or an invisible Turnstile, use invisible or floating mode.

### Load it

The endpoint always ends with a slash:

- capd: `https://<instance>/<siteKey>/`
- capjs-core: the route prefix, like `/cap/`

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Pin a version from https://github.com/tiagozip/cap/releases or `npm view cap-widget version`. With a bundler, `npm install cap-widget` and `import "cap-widget"`. To avoid jsDelivr, which is blocked in parts of China, turn on **Instance settings > Widget files > Serve widget files from this server** in capd and load `https://<instance>/assets/widget.js`, then set the WebAssembly URLs before the widget loads:

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://<instance>/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://<instance>/assets/hashwx.wasm";
</script>
```

### Standard mode

```html
<form action="/signup" method="POST">
  <cap-widget required data-cap-api-endpoint="https://<instance>/<siteKey>/"></cap-widget>
  <button type="submit">Sign up</button>
</form>
```

Inside a form, the widget adds a hidden input named `cap-token` once solved, so the token arrives with the other fields. `required` blocks submission until then. Outside a plain form, listen for the event:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

Events, each a `CustomEvent`: `solve` with `{ token }`, `progress` with `{ progress }` from 0 to 100, `error` with `{ isCap, code, message }`, and `reset` with `{}`.

### Floating mode

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>

<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://<instance>/<siteKey>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

From capd's asset server the floating script is `/assets/floating.js`. `data-cap-floating-position` is `top` or `bottom`, default `top`, and `data-cap-floating-offset` is the gap in pixels, default `8`. After a solve the button also has the token in `data-cap-token`.

### Invisible mode

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://<instance>/<siteKey>/" });

try {
  const { token } = await cap.solve();
  await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, "cap-token": token }),
  });
} catch (err) {
  console.error(err.code, err.message);
}
```

With the CDN script, `Cap` is a global. `solve()` resolves to `{ success, token }` and rejects with an `Error` that has a `code`. A second call while a solve is running resolves to `undefined`. `cap.token` holds the last token and `cap.reset()` clears it. Any other key in the config object is set as a widget attribute, like `"data-cap-worker-count": "4"`.

### Frameworks

The widget is a custom element and works in any framework. Copy the snippets at https://trycap.dev/guide/widget instead of improvising:

- React 19 and Preact: `onsolve={(e) => ...}`. React 18 and older need a ref and `addEventListener`.
- Next.js and other React meta-frameworks: put it in a component marked `"use client"`.
- Vue: `@solve`, and tell the compiler that `cap-` tags are custom elements with `isCustomElement: (tag) => tag.startsWith("cap-")`.
- Svelte 5: `onsolve`. Svelte 4: `on:solve`.
- Solid: `on:solve`. Qwik: `on:solve$`. Astro: a `<script>` that imports `cap-widget` and adds the listener.
- Server-rendered pages: import `cap-widget` only in the browser, since it registers a custom element.

### Attributes and page-wide options

Attributes: `data-cap-api-endpoint`, `data-cap-worker-count`, `data-cap-hidden-field-name`, `data-cap-lang`, `data-cap-troubleshooting-url`, `data-cap-disable-haptics` and `required`.

Labels: `data-cap-i18n-initial-state`, `-verifying-label`, `-solved-label`, `-error-label`, `-csp-error-label`, `-required-label`, `-troubleshooting-label`, `-wasm-disabled`, `-group-aria-label`, `-verify-aria-label`, `-verifying-aria-label`, `-verified-aria-label` and `-error-aria-label`. The widget ships Arabic, Chinese, French, German, Hindi, Japanese, Portuguese, Russian and Spanish, follows the browser language, and falls back to English. `data-cap-lang` or `window.CAP_LANG` forces one.

Page-wide options, set on `window` before the widget loads: `CAP_CUSTOM_FETCH`, `CAP_CSS_NONCE`, `CAP_SCRIPT_NONCE`, `CAP_ISOLATE`, `CAP_PAKO_URL`, `CAP_CUSTOM_WASM_URL`, `CAP_CUSTOM_HASHWX_URL`, `CAP_LANG`, `CAP_DISABLE_HAPTICS`, `CAP_DISABLE_WIDGET_REF`, `CAP_DEBUG` and `CAP_SILENT`.

Styling uses CSS variables on `cap-widget`: `--cap-background`, `--cap-border-color`, `--cap-border-radius`, `--cap-widget-height`, `--cap-widget-width`, `--cap-widget-padding`, `--cap-gap`, `--cap-color`, `--cap-font`, `--cap-checkbox-size`, `--cap-checkbox-border`, `--cap-checkbox-border-radius`, `--cap-checkbox-background`, `--cap-checkbox-margin`, `--cap-spinner-color`, `--cap-spinner-background-color`, `--cap-spinner-thickness`, `--cap-focus-ring`, `--cap-invalid-border-color`, `--cap-invalid-ring-color`, `--cap-troubleshoot-color`, and `--cap-checkmark` and `--cap-error-cross`, which take a `url()` image. Match the project's design tokens, including dark mode.

Cap is free for commercial use. Don't remove or hide the "Cap" credit in the widget's corner, and don't help the user do it.

### Content security policy

If the project sends a CSP, the widget needs:

- `script-src`: the widget's host or a nonce, plus `'wasm-unsafe-eval'`
- `worker-src`: `blob:`
- `connect-src`: the Cap server, plus `https://cdn.jsdelivr.net` unless the files are self-hosted
- `style-src`: a nonce, passed as `window.CAP_CSS_NONCE`

The instrumentation frame inherits the page's policy, so with a nonce-based `script-src` set `window.CAP_SCRIPT_NONCE` to the response's nonce before the widget loads. Without it every solve fails with `instr_csp_blocked`. Generate a new nonce per response. `'unsafe-eval'` isn't needed.

```html
<script nonce="{nonce}">
  window.CAP_SCRIPT_NONCE = "{nonce}";
  window.CAP_CSS_NONCE = "{nonce}";
</script>
<script nonce="{nonce}" src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

Set `window.CAP_ISOLATE = true` when the Cap endpoint is a server the user doesn't control, or on pages with a known HTML injection risk. The frame then gets an opaque origin, and keys that block interactions, behavior or agents reject those solves with `instr_isolated`.

---

## Step 9: Verify the token on the server

**This step isn't optional.** A token nobody verifies protects nothing, because an attacker skips the widget and posts the form directly.

### capd

Send the token to `/siteverify` from the backend before doing any work:

```
POST https://<instance>/<siteKey>/siteverify
Content-Type: application/json

{ "secret": "sk-...", "response": "<token>" }
```

`application/x-www-form-urlencoded` with the same two fields also works, so form-encoded reCAPTCHA and hCaptcha code only needs a new URL and secret.

```js
const verifyCap = async (token) => {
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch(`${process.env.CAP_URL}/${process.env.CAP_SITE_KEY}/siteverify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.CAP_SECRET, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
};
```

```py
import requests

def verify_cap(token):
    if not token:
        return False
    try:
        res = requests.post(
            f"{CAP_URL}/{CAP_SITE_KEY}/siteverify",
            json={"secret": CAP_SECRET, "response": token},
            timeout=5,
        )
        return res.json().get("success") is True
    except requests.RequestException:
        return False
```

```php
$res = @file_get_contents("$capUrl/$capSiteKey/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => $capSecret, "response" => $token]),
    "timeout" => 5,
    "ignore_errors" => true,
  ],
]));
$ok = $res !== false && (json_decode($res, true)["success"] ?? false) === true;
```

A valid token returns `200`. With every optional field present, the body looks like this:

```json
{
  "success": true,
  "riskFlags": [],
  "behavior": { "score": 0.12, "verdict": "ok", "agent": { "name": "...", "confidence": "high", "verified": false } },
  "rules": ["<rule id>"]
}
```

A clean solve returns only `{ "success": true }`. The other fields appear when there's something to report: `riskFlags` when the solve has risk flags, `behavior` when behavior scoring is on, `agent` at the top level when scoring is off and an agent was detected, and `rules` with the IDs of rules that matched. The backend can use them to add friction, for example by asking for email verification when `riskFlags` contains an `agent:` entry.

Failures return `success: false` and a string `error`:

| Status | `error` | Cause |
| --- | --- | --- |
| 400 | `Missing required parameters` | `secret` or `response` is missing, or the token isn't three parts separated by colons |
| 403 | `Invalid site key or secret` | Wrong secret, often the admin key by mistake |
| 403 | `Token expired` | More than 2 hours passed between the solve and the check |
| 403 | A message about an older Cap release | The secret predates v4. Reset it under **Danger zone**. |
| 404 | `Invalid site key or secret` | The site key in the token doesn't exist |
| 404 | `Token not found` | The token was already verified once, or never existed |

Rules:

- **Tokens are single-use.** capd deletes the token on the first check with a valid secret, even when the token has expired. Verify once, in one place.
- **Verify before side effects:** before the database write, the email, the payment or the paid API call.
- **Fail closed.** A timeout, a network error or a non-JSON response means rejection.
- **Use the secret key**, never `ADMIN_KEY`.
- **Call `/siteverify` from the server only.** It's limited to 1,000 requests per 10 s per IP.
- **Reject missing tokens with the same error as invalid ones**, and keep the old CAPTCHA's error message and status code so the frontend's error handling still works.

### capjs-core

There is no `/siteverify`. Re-derive the token key and delete it on read, as in step 7.

---

## Step 10: Migrate from another CAPTCHA

The verify call takes the same `secret` and `response` fields as reCAPTCHA, hCaptcha and Turnstile.

| | reCAPTCHA | hCaptcha | Turnstile | Cap |
| --- | --- | --- | --- | --- |
| Script | `https://www.google.com/recaptcha/api.js` | `https://js.hcaptcha.com/1/api.js` | `https://challenges.cloudflare.com/turnstile/v0/api.js` | `https://cdn.jsdelivr.net/npm/cap-widget@<version>` |
| Element | `<div class="g-recaptcha" data-sitekey>` | `<div class="h-captcha" data-sitekey>` | `<div class="cf-turnstile" data-sitekey>` | `<cap-widget data-cap-api-endpoint="https://<instance>/<siteKey>/">` |
| Form field | `g-recaptcha-response` | `h-captcha-response` | `cf-turnstile-response` | `cap-token` |
| Verify URL | `https://www.google.com/recaptcha/api/siteverify` | `https://api.hcaptcha.com/siteverify` | `https://challenges.cloudflare.com/turnstile/v0/siteverify` | `https://<instance>/<siteKey>/siteverify` |
| Request fields | `secret`, `response`, `remoteip` | `secret`, `response`, `remoteip`, `sitekey` | `secret`, `response`, `remoteip` | `secret`, `response`. Other fields are ignored. |
| Errors | `error-codes` array | `error-codes` array | `error-codes` array | `error` string |
| Extra fields | `score`, `action`, `challenge_ts`, `hostname` | `challenge_ts`, `hostname`, `score` on Enterprise | `challenge_ts`, `hostname`, `action`, `cdata` | `riskFlags`, `behavior`, `agent`, `rules` |

Migration notes:

- **Code that only reads `success`** needs a new URL and secret, nothing else.
- **Code that reads `error-codes`** should read `error`, or just treat any `success !== true` as a failure.
- **reCAPTCHA v3 scores and actions** have no equivalent. Replace `score >= 0.5` checks with `success === true`, and use `riskFlags` or `behavior.verdict` for extra friction. Replace `grecaptcha.execute(siteKey, { action })` with `await cap.solve()` in invisible mode. To keep one route's tokens from working on another, use a separate site key per route on capd or a `scope` per route in capjs-core.
- **`hostname` checks** become the key's **Only allow these websites** list.
- **Backend SDKs that hardcode the provider's URL**, like `google-recaptcha` packages or framework validators, should be replaced with the direct `/siteverify` call shown in step 9.
- **To keep the backend untouched** during a gradual rollout, `data-cap-hidden-field-name="g-recaptcha-response"` makes the widget post its token under the old field name. Rename it once the old provider is gone.
- **Zero downtime:** accept either provider's token for one deploy, watch Cap's pass rate on the dashboard's overview, then remove the old provider.
- **Remove** the old script tag, packages, framework wrappers, CSP entries for `google.com`, `gstatic.com`, `hcaptcha.com` or `challenges.cloudflare.com`, environment variables, tests and mocks.

Provider guides: https://trycap.dev/guide/alternatives/migrate-from-recaptcha, https://trycap.dev/guide/alternatives/hcaptcha and https://trycap.dev/guide/alternatives/turnstile

---

## Step 11: Prove it works

Don't tell the user you're done until all of these pass. Do them yourself as far as the environment allows.

1. **The widget solves.** Load the page, watch the checkbox turn into a checkmark, and check the console for errors. With headless blocking on, a headless test browser fails by design.
2. **A real submission passes.** Submit the form and confirm the endpoint does what it did before.
3. **A forged submission fails.** Post without a token, and again with a junk token:

   ```bash
   curl -i -X POST https://<app>/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test1234"}'
   ```

   Both must be rejected. If either succeeds, step 9 isn't wired up.
4. **Tokens are single-use.** Verify one real token twice. The second check must fail with `Token not found` on capd.
5. **Outage fails closed.** Point the backend at an unreachable Cap URL and confirm submissions are rejected.
6. **Tests and CI still pass.** Mock the verify function in unit tests, not the network call, and keep one test that asserts a failed verification rejects the request.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `/siteverify` always returns `Invalid site key or secret` | `ADMIN_KEY` used as the secret, or the secret belongs to another key | Use the `sk-` secret of the key in the widget's endpoint |
| `/siteverify` returns `Token not found` on the first try | The token was already verified, for example by middleware and again by the handler | Verify in one place |
| The widget shows "Blocked by this page", code `instr_csp_blocked` | The CSP blocks the instrumentation script | Set `window.CAP_SCRIPT_NONCE` and add `'wasm-unsafe-eval'` and `worker-src blob:` |
| Code `challenge_unsupported` | HashWX in a browser without WebAssembly, or a widget older than 0.1.58 | Update the widget, or turn on the SHA-256 fallback |
| Code `network_error`, CORS error in the console | The endpoint is wrong, is missing its trailing slash, isn't public, or the origin isn't in **Only allow these websites** | Fix the URL and add the origin |
| Code `invalid_expires` | The server clock is wrong | Sync the clock with NTP |
| Code `instr_timeout` | The instrumentation script didn't answer within 20 s of the widget finalizing it | Retry the solve, and check the console for errors from the frame |
| `instr_widget_outdated` in events | An old widget on a key with interaction, behavior or agent blocking | Update the pinned widget version |
| `behavior_no_interaction` in events | Invisible or floating mode on a key with `requireInteraction: true` | Set `requireInteraction` to `false` |
| `instr_isolated` in events | The page sets `CAP_ISOLATE` on a key that needs page data | Turn off those blocks for the key, or remove `CAP_ISOLATE` |
| `rate_limited` in events for many visitors at once | capd sees the proxy's IP for every visitor, so they share one bucket | Set **Your proxy or CDN** under **Visitor location** |
| A key's secret can't be revealed | `ADMIN_KEY` changed, or the key predates encrypted secrets | Reset the secret under **Danger zone** |
| Solves are slow on phones | Difficulty too high for the audience | Lower `hashwxDifficulty` to 500,000 |

Every error code with its meaning: https://trycap.dev/guide/error-codes. Visitors who are blocked can check their browser at https://trycap.dev/guide/troubleshooting/instrumentation, or at `data-cap-troubleshooting-url` if the site sets one.

If a question isn't answered here or in the docs, clone the source and look it up before you guess:

```bash
git clone --depth 1 https://github.com/tiagozip/cap /tmp/cap
rg -n "<the option, error code or message>" /tmp/cap
```

The widget is in `widget/src`, capd in `capd/src`, and capjs-core in `core/src`. https://trycap.dev/agent.md has a full map of where things live.

If something still fails and you're sure the bug is in Cap, check that the widget and capd are on their latest releases, then ask the user to open an issue at https://github.com/tiagozip/cap/issues.

---

## Checklist before you finish

- The widget is on every protected form, and every protected route verifies the token on the server.
- The secret is only on the server, in the project's usual secret store, and isn't committed.
- The endpoint ends with a slash, points at a public HTTPS URL, and its origin is allowed.
- The widget version is pinned.
- Verification happens once, before side effects, and fails closed.
- capd knows the real client IP.
- The old CAPTCHA is gone, along with its secrets, CSP entries, packages and tests.
- capjs-core only: `consumeNonce` is atomic, tokens are deleted on read, `scope` matches, and `CAP_SECRET` isn't bundled.

Tell the user what you changed, which credentials and environment variables they need to set in each environment, which old secrets they can revoke, and what you couldn't test.

---

## Reference

- Facts for answering questions about Cap: https://trycap.dev/agent.md
- Documentation index: https://trycap.dev/llms.txt
- Full documentation in one file: https://trycap.dev/llms-full.txt
- Quickstart: https://trycap.dev/guide/
- Widget: https://trycap.dev/guide/widget
- capd: https://trycap.dev/guide/capd/ and https://trycap.dev/guide/capd/options
- capjs-core: https://trycap.dev/guide/capjs-core
- Error codes: https://trycap.dev/guide/error-codes
- Source: https://github.com/tiagozip/cap
