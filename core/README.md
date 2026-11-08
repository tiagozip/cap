# capjs-core

Stateless challenge generation and verification for [Cap](https://trycap.dev), the self-hosted CAPTCHA for the modern web.

## Install

```sh
bun add capjs-core
# or: npm install capjs-core
```

## Usage

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// long, random, high-entropy. keep this consistent across processes.
const SECRET = process.env.CAP_SECRET;

// 1) Server route: create a challenge
const challenge = await generateChallenge(SECRET, {
  scope: "signup",        // optional
  instrumentation: true,  // optional
});
// → { token, format: 2, challenges, expires }

// 2) Server route: validate the redeemed challenge
const result = await validateChallenge(SECRET, {
  token: req.body.token,
  solutions: req.body.solutions,
  instr: req.body.instr,
}, {
  scope: "signup",
  // optional: prevent replay
  consumeNonce: async (sigHex, ttlMs) =>
    await myStore.setIfNotExists(`cap:${sigHex}`, 1, ttlMs),
});

if (result.success) {
  // result.token, result.tokenKey, result.expires, result.scope
}
```

## API

### `generateChallenge(secret, opts?) → { token, format: 2, challenges, expires }`

Issues HashWX proof of work by default. HashWX needs widget 0.1.58 or later.

- `secret` — string or Buffer ≥16 bytes. Master HMAC key.
- `opts.format` — `2` by default. `1` issues SHA-256 proof of work and returns `{ challenge, token, expires, instrumentation? }`
- `opts.protocols` — format-2 protocols, default `["hashwx"]` plus `"instrumentation"` when instrumentation or behavior is on
- `opts.challengeCount` — format 1, default `50`. Passing it, `challengeSize` or `challengeDifficulty` without `format` picks format 1
- `opts.challengeSize` — format 1, default `32`
- `opts.challengeDifficulty` — format 1, default `4`
- `opts.expiresMs` — default `600000` (10 min)
- `opts.scope` — optional string bound to the challenge
- `opts.extra` — optional object embedded in the JWT payload
- `opts.instrumentation` — `true` or `{ blockAutomatedBrowsers, obfuscationLevel }`
- `opts.instrumentationGenerator` — optional custom generator (escape hatch for offloading to a worker pool)
- `opts.behavior` is `true` or a policy object. It turns instrumentation on even when `opts.instrumentation` is off, because the trace is collected and bound by the script.

A custom generator should return what `generateInstrumentation(opts)` returns, including `binding`. A generator that returns `expectedVals` without a `binding` only has its state checked, so the server ignores any collected data and a challenge that asks for behavior fails with `behavior_missing`. If the result has neither, `generateChallenge` throws, so a generator written for 0.1.6 that copies `expectedVals` from `generateInstrumentation` fails when it issues a challenge instead of on every redeem. Return the whole result, or copy `binding` as well.

The `token` is a signed JWT containing the challenge config; `expires` is when it expires; `instrumentation` is the deflate+base64 client-side script (if requested).

### `validateChallenge(secret, body, opts?) → { success, ... }`

`body`:
- `token` — challenge token from `generateChallenge`
- `solutions` — number array (length = `challenge.c`)
- `instr` — instrumentation result (if enabled), exactly `{ i, state, d }`. `d` is the canonical JSON of everything the script collected, and the script folds a seeded hash of `d` into `state`, so editing `d` breaks the state check. The server reads nothing about the browser from outside `d`.
- `instr_blocked`, `instr_timeout` — flags from the widget

`opts`:
- `scope` — must match the original challenge's scope
- `tokenTtlMs` — TTL for the redeem token (default 20 min)
- `consumeNonce(sigHex, ttlMs)` — replay prevention via your storage
- `signToken(data)` — async fn returning a custom redeem token format

Returns success: `{ success: true, token, tokenKey, expires, scope, iat }`. The default redeem token is `id:secret`; `tokenKey` is `id:HMAC(secret)` — store the key in your DB, give the token to the user, then look it up later by re-running `tokenKey = id:HMAC(submittedSecret)`.

Returns failure: `{ success: false, reason, instr_error? }`. Reasons:

| reason | meaning |
| --- | --- |
| `invalid_body` | body isn't an object |
| `missing_token` | no token provided |
| `missing_solutions` | solutions missing or not an array |
| `invalid_token` | JWT signature mismatch / malformed / out-of-bounds params |
| `scope_mismatch` | token's scope doesn't match `opts.scope` |
| `expired` | challenge JWT expired |
| `invalid_solutions` | length mismatch or non-numbers |
| `nonce_store_error` | your `consumeNonce` callback threw |
| `already_redeemed` | `consumeNonce` returned `false` |
| `invalid_solution` | solutions don't satisfy the PoW |
| `instr_*` | instrumentation failed (with `instr_error: true`) |

## Stateless by design

- No `fs`, no `process.on('SIGINT')`, no in-memory token list.
- Challenge tokens are signed JWTs (HS256). Verification is pure cryptography.
- Instrumentation metadata is encrypted (AES-256-GCM) inside the JWT — server doesn't need to remember it.
- Replay prevention is opt-in via your `consumeNonce` callback (Redis `SET NX EX`, etc.).

## Performance

Apple M-series, bun 1.3, single core, no instrumentation:

| operation | params | ops/s |
| --- | --- | ---: |
| `generateChallenge` | defaults (c=50 s=32 d=4) | ~350,000 |
| `generateChallenge` | small (c=5 s=16 d=2) | ~450,000 |
| `validateChallenge` | defaults | ~4,400 |
| `validateChallenge` | small | ~36,000 |
| `validateChallenge` | invalid token (early-exit) | ~2,400,000 |
| `validateChallenge` | bad signature (HMAC reject) | ~310,000 |

With instrumentation:

| operation | level | ops/s |
| --- | --- | ---: |
| `generateChallenge + instrumentation` | 1 (no obfuscator) | ~10,700 |
| `generateChallenge + instrumentation` | 3 (default) | ~44 |
| `generateChallenge + instrumentation` | 8 (string array + control flow) | ~5 |

Instrumentation generation at level 3+ blocks the event loop. If you need higher throughput, supply your own `instrumentationGenerator` that runs in a forked child or worker.

Run `bun test/benchmark.js` to reproduce.

## Migrating from `@cap.js/server`

Unlike Cap's old server library, `capjs-core` does not include a token store. For most users we recommend running [capd](https://trycap.dev/guide/capd/) (Docker, batteries included), but if you can't run Docker:

| `@cap.js/server` | `capjs-core` |
| --- | --- |
| `new Cap({ ... })` | (no constructor — pass your secret per call) |
| `cap.createChallenge(opts)` | `generateChallenge(secret, opts)` |
| `cap.redeemChallenge({ token, solutions })` | `validateChallenge(secret, { token, solutions })` |
| `cap.validateToken(redeemToken)` | look up `tokenKey` in your DB yourself |
| `config.storage.tokens.*` | use your own KV |
| `config.tokens_store_path` | gone (no filesystem) |
| `SIGINT`/`beforeExit` cleanup | gone (TTL via JWT `exp` and your KV's expiry) |

For replay prevention, pass a `consumeNonce` callback to `validateChallenge`. `capjs-core` calls it with the JWT signature hex and the remaining TTL; you store that hex in your KV (e.g. `SET cap:<sig> 1 NX EX <ttl>`) and return `false` on repeats.

## License

Apache-2.0
