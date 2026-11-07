---
outline: [2, 3]
description: "capjs-core is Cap's stateless server library for generating and verifying proof-of-work challenges with signed JWTs. Run the open-source CAPTCHA on Workers, Lambda or your own backend."
---

# Core library

`capjs-core` generates and verifies challenges inside your own server. It's stateless: a challenge is a signed JWT, so it needs no database, no filesystem and no in-memory state, and it runs on Cloudflare Workers, Lambda and other edge runtimes. Standalone is built on it.

Most people should run [Standalone](./standalone/index.md) instead, which adds a dashboard, stats, rate limiting and token storage. Use the library when you can't run a container, or want challenges inside an existing service.

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

## Getting started

You need two routes, one that creates a challenge and one that checks the solution. Point the widget's `data-cap-api-endpoint` at their common prefix, and the widget calls `<prefix>challenge` and `<prefix>redeem`.

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

app.post("/cap/challenge", async () => {
  return await generateChallenge(SECRET, { instrumentation: true });
});

app.post("/cap/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```

`SECRET` signs every challenge. Make it long and random, at least 16 bytes, and use the same one in every process.

`consumeNonce` stops a solved challenge from being redeemed twice, and you supply it from your own storage. See [replay prevention](#replay-prevention).

## Verifying tokens

A successful `validateChallenge` returns a `token` for the visitor and a `tokenKey` for you. The library doesn't store either, so save `tokenKey` with its `expires`:

```js
const result = await validateChallenge(SECRET, req.body, { consumeNonce });
if (result.success) {
  await store.set(`cap-token:${result.tokenKey}`, result.expires);
}
return result;
```

The widget hands `token` to your form. When the form arrives, derive the key from the submitted token and look it up:

```js
import { createHash } from "node:crypto";

const [id, secret] = req.body["cap-token"].split(":");
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await store.get(`cap-token:${tokenKey}`);

if (!expires || Number(expires) < Date.now()) {
  return new Response("invalid captcha", { status: 403 });
}
await store.delete(`cap-token:${tokenKey}`);
```

Deleting the key makes each token single-use.

## HashWX {#format-2-hashwx}

Without options, `generateChallenge` issues SHA-256 proof of work. [HashWX](./hashwx.md) resists GPUs far better, and Standalone uses it for new keys. Opt in with the format-2 API:

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

The widget detects the format on its own, and `validateChallenge` handles both.

| Option | Default | What it does |
| --- | --- | --- |
| `hashwxDifficulty` | `1_000_000` | Expected hashes per solve, across all sub-challenges. |
| `hashwxChallengeCount` | `4` | Sub-challenges the difficulty is split into. More of them make solve times less random. See [client cost](./hashwx.md#cost). |
| `hashwxNoncesPerHash` | `65_536` | Nonces covered by each generated hash function. |

HashWX needs no keys or setup. The first verification compiles a small WebAssembly module, and you can `await hashwxReady()` at startup to do that early.

Some runtimes don't allow compiling WebAssembly at runtime. Cloudflare Workers get a precompiled module automatically. Elsewhere, import it the way your platform supports and pass it in before the first verification:

```js
import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";

setHashwxModule(hashwxModule);
```

## Replay prevention

`validateChallenge` calls `consumeNonce(signature, ttlMs)` after the proof of work and instrumentation pass. Store the signature if it's new and return `true`. Return `false` if it was already used. Since the check runs last, a replayed request with bad solutions can't use up a real visitor's challenge.

::: code-group

```js [Redis]
const consumeNonce = async (sig, ttlMs) =>
  (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK";
```

```js [Workers KV]
const consumeNonce = async (sig, ttlMs) => {
  if (await env.NONCES.get(`cap:${sig}`)) return false;
  await env.NONCES.put(`cap:${sig}`, "1", { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) });
  return true;
};
```

```js [Postgres]
const consumeNonce = async (sig, ttlMs) => {
  try {
    await sql`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sig}, ${new Date(Date.now() + ttlMs)})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false;
    throw e;
  }
};
```

:::

Workers KV isn't atomic, so two requests that arrive together can both pass. Use a Durable Object if that matters.

## Instrumentation

`instrumentation: true` adds an [instrumentation challenge](./instrumentation.md) to format-1 challenges. With format 2, add `"instrumentation"` to `protocols`. Both accept options in place of `true`:

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

`obfuscationLevel` runs from 1 to 10 and defaults to 3. Levels 8 to 10 use `javascript-obfuscator` and block the event loop for tens of milliseconds per challenge, so keep them for low-traffic routes, or generate scripts in a worker pool with `instrumentationGenerator`.

`detectAutomation(vector)` runs the automated browser checks over a probe vector you collected yourself.

## API

### `generateChallenge(secret, options?)`

| Option | Default | What it does |
| --- | --- | --- |
| `challengeCount` | `50` | SHA-256 puzzles per challenge. |
| `challengeSize` | `32` | Salt length in hex characters. |
| `challengeDifficulty` | `4` | Required hash prefix length in hex characters. |
| `expiresMs` | `600_000` | How long the visitor has to solve it. |
| `scope` | none | A string bound to the challenge. Validation has to pass the same one. |
| `extra` | none | Data embedded in the JWT. Anyone with the token can read it. |
| `instrumentation` | `false` | See [instrumentation](#instrumentation). |
| `format`, `protocols` | format 1 | See [HashWX](#format-2-hashwx). |

### `validateChallenge(secret, body, options?)`

`body` is what the widget posts to `/redeem`. The options are:

| Option | Default | What it does |
| --- | --- | --- |
| `consumeNonce` | none | See [replay prevention](#replay-prevention). |
| `scope` | none | Must match the challenge's scope. |
| `tokenTtlMs` | `1_200_000` | How long the visitor's token stays valid. |
| `signToken` | `id:secret` | Async function that returns your own token format. |

On success it returns `{ success: true, token, tokenKey, expires, scope, riskFlags }`. `riskFlags` lists automation signals that don't block on their own, like `native_tamper`, so you can raise the difficulty for that visitor.

On failure it returns `{ success: false, reason }`:

| `reason` | Meaning |
| --- | --- |
| `invalid_body`, `missing_token`, `missing_solutions` | The request is malformed. |
| `invalid_token` | The JWT is forged, malformed or out of bounds. |
| `scope_mismatch` | The scope differs from the challenge's. |
| `expired` | The challenge expired before it was redeemed. |
| `invalid_solutions`, `invalid_solution` | The proof of work is wrong. |
| `already_redeemed` | `consumeNonce` returned `false`. |
| `nonce_store_error` | `consumeNonce` threw. |
| `instr_*` | Instrumentation failed. `instr_automated_browser` comes with a `blockedBy` list of the [checks](./instrumentation.md#automated-browser-detection) that failed. |

## Migrating from `@cap.js/server` {#how-it-differs-from-cap-js-server}

`@cap.js/server` is the older library, superseded by this one. It kept challenges and tokens in storage you configured. `capjs-core` keeps nothing. Challenges are signed JWTs, replay prevention goes through `consumeNonce`, and you store `tokenKey` yourself as shown in [verifying tokens](#verifying-tokens). It never touches the filesystem, so it runs on Workers and Lambda.
