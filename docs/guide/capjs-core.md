---
outline: [2, 3, 4]
---

# Core

Cap includes a stateless server-side library for generating and verifying JWT-based challenges, which is used internally for Standalone.

For most users we recommend [Cap Standalone](./standalone/index.md) which runs on Docker and is batteries included. We only recommend using the core library directly when you can't run Docker, want to embed challenge generation into an existing service, or need to deploy to an environment without persistent storage (Cloudflare Workers, Lambda, edge functions).

## Installation

::: code-group

```sh [bun]
bun add capjs-core
```

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm i capjs-core
```

:::

## Getting started

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// Long, random, high-entropy. Keep this consistent across processes.
const SECRET = process.env.CAP_SECRET;

// 1) Server route: create a challenge
const ch = await generateChallenge(SECRET, {
  scope: "signup",        // optional
  instrumentation: true,  // optional, see below
});
// → { challenge: { c, s, d }, token, expires, instrumentation? }

// 2) Server route: validate the redeemed challenge
const result = await validateChallenge(
  SECRET,
  {
    token: req.body.token,
    solutions: req.body.solutions,
    instr: req.body.instr,
  },
  {
    scope: "signup",
    consumeNonce: async (sigHex, ttlMs) =>
      myStore.setIfNotExists(`cap:${sigHex}`, 1, ttlMs),
  },
);

if (result.success) {
  // result.token, result.tokenKey, result.expires, result.scope
}
```

The widget calls `generateChallenge` to receive `{ challenge, token, expires, instrumentation }`, solves the proof of work client-side, and POSTs `{ token, solutions, instr }` back. You then call `validateChallenge` to verify.

## How it differs from `@cap.js/server`

| Aspect | `@cap.js/server` | `capjs-core` |
| --- | --- | --- |
| State | In-memory + filesystem token store | Stateless. Challenge tokens are signed JWTs |
| Constructor | `new Cap({ ... })` | None — pass `secret` per call |
| Replay prevention | Built-in token list with cleanup interval | Opt-in via `consumeNonce` callback |
| Cleanup hooks | `SIGINT`/`beforeExit` flush | None — TTL is encoded in JWT `exp` |
| Filesystem | Required for persistence | Never touched |
| Worker compatible | No (filesystem) | Yes |

Unlike the old library, `capjs-core` does not validate redeem tokens for you — it returns a `tokenKey` you store yourself, and a `token` you give the user. To validate later, re-derive the key from the user's submitted token and look it up:

```js
import { createHash } from "node:crypto";

// Validation route
const [id, verToken] = req.body.token.split(":");
const tokenKey = `${id}:${createHash("sha256").update(verToken).digest("hex")}`;
const expires = await myStore.get(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) {
  return res.status(401).end();
}
```

## API

### `generateChallenge(secret, opts?)`

Returns `Promise<{ challenge, token, expires, instrumentation? }>`.

- `secret` — string or Buffer, ≥16 bytes. Master HMAC key, must be consistent across processes.
- `opts.challengeCount` — number of PoW puzzles. Default `50`.
- `opts.challengeSize` — salt length in hex chars. Default `32`.
- `opts.challengeDifficulty` — target prefix length in hex chars. Default `4`.
- `opts.expiresMs` — challenge TTL. Default `600_000` (10 min).
- `opts.scope` — optional string bound to the challenge. Validation must pass the same `scope`.
- `opts.extra` — optional object embedded in the JWT payload (visible to anyone with the token).
- `opts.instrumentation` — `true` for defaults, or an object: `{ blockAutomatedBrowsers, obfuscationLevel }`.
- `opts.instrumentationGenerator` — escape hatch for offloading script generation to a worker pool.

The `token` is a signed JWT containing the challenge config. `expires` is the JWT expiry in ms. `instrumentation`, if requested, is the deflate+base64 client-side script to be run by the widget.

### `validateChallenge(secret, body, opts?)`

Returns `Promise<{ success: true, token, tokenKey, expires, scope, iat } | { success: false, reason, instr_error? }>`.

`body`:
- `token` — challenge token from `generateChallenge`
- `solutions` — number array, length must equal `challenge.c`
- `instr` — instrumentation result (if you enabled it)
- `instr_blocked`, `instr_timeout` — flags from the widget when instrumentation rejected the page

`opts`:
- `scope` — must match the original challenge's scope
- `tokenTtlMs` — TTL for the redeem token. Default `1_200_000` (20 min).
- `consumeNonce(sigHex, ttlMs)` — replay prevention via your storage. See below.
- `signToken(data)` — async fn returning a custom redeem token format. By default returns `id:secret`.

#### Failure reasons

| `reason` | meaning |
| --- | --- |
| `invalid_body` | body isn't an object |
| `missing_token` | no token provided |
| `missing_solutions` | solutions missing or not an array |
| `invalid_token` | JWT signature mismatch / malformed / out-of-bounds params |
| `scope_mismatch` | token's scope doesn't match `opts.scope` |
| `expired` | challenge JWT expired |
| `invalid_solutions` | length mismatch or non-numbers |
| `nonce_store_error` | `consumeNonce` callback threw |
| `already_redeemed` | `consumeNonce` returned `false` |
| `invalid_solution` | solutions don't satisfy the PoW |
| `instr_*` | instrumentation failed (with `instr_error: true`) |

## Replay prevention

The library is stateless by design. To prevent a captured submission from being redeemed twice, pass a `consumeNonce` callback. `capjs-core` calls it with the JWT's signature hex and the remaining TTL; you store that hex in your KV with `SET NX EX` semantics and return `false` on repeats.

::: code-group

```js [redis]
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

const consumeNonce = async (sigHex, ttlMs) => {
  const ttlSec = Math.ceil(ttlMs / 1000);
  const ok = await redis.set(`cap:${sigHex}`, "1", "NX", "EX", ttlSec);
  return ok === "OK";
};
```

```js [cloudflare-kv]
const consumeNonce = async (sigHex, ttlMs) => {
  const key = `cap:${sigHex}`;
  if (await env.NONCES.get(key)) return false;
  await env.NONCES.put(key, "1", {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return true;
};
```

```js [postgres]
const consumeNonce = async (sigHex, ttlMs) => {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  try {
    await db`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sigHex}, ${expiresAt})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false; // unique violation
    throw e;
  }
};
```

:::

The check runs *after* PoW and instrumentation verification, so an attacker who replays a captured submission with garbage solutions can't burn the legitimate user's nonce.

## Instrumentation

Pass `instrumentation: true` (or an options object) to `generateChallenge` to receive a deflate+base64 client script. The widget runs it, sends back a fingerprint, and `validateChallenge` verifies it.

```js
const ch = await generateChallenge(SECRET, {
  instrumentation: {
    blockAutomatedBrowsers: true, // reject playwright/puppeteer/selenium
    obfuscationLevel: 3,          // 1-10, default 3
  },
});
```

When `blockAutomatedBrowsers` is on, the script runs realm-escape and behavioral checks that detect headless Chromium, automation framework markers, and JS-sandbox impersonation. See [Instrumentation](./instrumentation.md) for details.

Higher obfuscation levels are slower to generate. Levels 4–7 add a custom string-table indirection plus esbuild minification. Levels 8–10 layer in `javascript-obfuscator` (string-array, control-flow flattening, dead-code injection) — these block the event loop for tens of milliseconds per challenge, so use them only for low-volume routes or supply your own `instrumentationGenerator` that runs in a worker pool.

## Stateless deployment patterns

**Warning:** These scripts don't include built-in replay protection. Make sure to add it yourself.

### Cloudflare Workers

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = (env) => env.CAP_SECRET;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/challenge" && req.method === "POST") {
      const ch = await generateChallenge(SECRET(env), { instrumentation: true });
      return Response.json(ch);
    }

    if (url.pathname === "/redeem" && req.method === "POST") {
      const body = await req.json();
      const result = await validateChallenge(SECRET(env), body, {
        consumeNonce: async (sigHex, ttlMs) => {
          if (await env.NONCES.get(`cap:${sigHex}`)) return false;
          await env.NONCES.put(`cap:${sigHex}`, "1", {
            expirationTtl: Math.ceil(ttlMs / 1000),
          });
          return true;
        },
      });
      return Response.json(result);
    }

    return new Response("not found", { status: 404 });
  },
};
```

### Bun

```js
import { generateChallenge, validateChallenge } from "capjs-core";
const SECRET = process.env.CAP_SECRET;

Bun.serve({
  port: 3000,
  routes: {
    "/challenge": {
      POST: () => Response.json(generateChallenge(SECRET, { instrumentation: true })),
    },
    "/redeem": {
      POST: async (req) => {
        const body = await req.json();
        return Response.json(await validateChallenge(SECRET, body));
      },
    },
  },
});
```