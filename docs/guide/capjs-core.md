---
outline: [2, 3]
description: "capjs-core is Cap's stateless server library for generating and verifying proof-of-work challenges with signed JWTs. Run the open-source CAPTCHA on Workers, Lambda or your own backend."
---

# Core library

`capjs-core` generates and verifies challenges inside your own server. It's stateless: a challenge is a signed JWT, so it needs no database, no filesystem and no in-memory state, and it runs on Cloudflare Workers, Lambda and other edge runtimes. capd is built on it.

Most people should run [capd](./capd/index.md), Cap's server, instead, which adds a dashboard, stats, rate limiting and token storage. Use the library when you can't run a container, or want challenges inside an existing service.

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

Without options, `generateChallenge` issues SHA-256 proof of work. [HashWX](./hashwx.md) resists GPUs far better, and capd uses it for new keys. Opt in with the format-2 API:

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

The widget detects the format on its own, and `validateChallenge` handles both. Always pass `protocols` with format 2. Without it, the challenge uses the deprecated RSW protocol, which needs an RSA keypair in `keypair` or a minter in `rsw`.

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

`validateChallenge` calls `consumeNonce(signature, ttlMs)` once the proof of work checks out, and before it checks instrumentation. Store the signature if it's new and return `true`. Return `false` if it was already used. A request with a wrong proof of work never reaches it, so it can't use up a real visitor's challenge. A request with a valid proof of work and a failing instrumentation result does use it up, so a bot can't retry the instrumentation check against the same proof of work.

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

`instrumentation: true` adds an [instrumentation challenge](./instrumentation.md) to format-1 challenges. With format 2, add `"instrumentation"` to `protocols`. In both cases you can pass an object in place of `true`:

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

| Option | Default | What it does |
| --- | --- | --- |
| `blockAutomatedBrowsers` | `false` | Fails solves from [automated browsers](./instrumentation.md#automated-browser-detection) with `instr_automated_browser`. |
| `detectAutomatedInteractions` | `false` | Adds `interaction_synthetic_clicks` and `interaction_synthetic_keydowns` to `riskFlags`. See [interaction detection](./instrumentation.md#interaction-detection). |
| `blockAutomatedInteractions` | `false` | Fails those solves with `instr_automated_interaction`. Turns on detection too. |
| `obfuscationLevel` | `5` | From 1 to 10. Levels 1 to 3 strip whitespace, 4 to 7 also encode strings and minify, and 8 to 10 run `javascript-obfuscator` when it is installed. Higher levels are slower to generate. |

Levels 8 to 10 need the optional `javascript-obfuscator` package and block the event loop for tens of milliseconds per challenge, so keep them for low-traffic routes, or generate scripts in a worker pool with `instrumentationGenerator`. It receives the instrumentation options and has to resolve to what `generateInstrumentation` returns.

## Behavior and agents

`behavior` turns on [behavior scoring](./instrumentation.md#behavior-scoring) and [agent blocking](./instrumentation.md#ai-agent-detection). It adds an instrumentation challenge if the challenge has none, and the policy is signed into the challenge token, so the client can't turn it off.

```js
await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
  behavior: { block: true, blockAgents: "identified" },
});
```

`behavior: true` scores without blocking. The object takes:

| Option | Default | What it does |
| --- | --- | --- |
| `block` | `false` | Fails `automated` verdicts with `behavior_automated`, and `no_interaction` verdicts with `behavior_no_interaction`. |
| `threshold` | `0.75` | Score from 0.1 to 1 at which the verdict becomes `automated`. |
| `strict` | `false` | Lifts the 0.6 cap on scores made only of weak flags. |
| `requireInteraction` | `true` | Set it to `false` to let `no_interaction` through when `block` is on, for invisible and floating mode. |
| `blockAgents` | `false` | `"identified"` fails agents detected with high confidence, and `"all"` fails every detected agent, with `behavior_agent`. |
| `allowVerifiedAgents` | `false` | Lets agents with a verified Web Bot Auth signature through `blockAgents`. |

A solve with no behavior trace always fails with `behavior_missing`, whatever the policy.

To use request headers as agent evidence, pass the `/redeem` request to `validateChallenge`:

```js
const result = await validateChallenge(SECRET, body, {
  consumeNonce,
  request: { method: req.method, url: fullUrl, headers: req.headers },
  verifyWebBotAuth: true,
});
```

`url` has to be the full URL, since Web Bot Auth signs it. With `verifyWebBotAuth: true`, a request that carries a `Signature-Agent` header is checked against the agent's key directory, which `validateChallenge` fetches over HTTPS and caches for an hour. It only trusts the signers Cap knows and the origins in `trustedSignatureAgents`. Pass `webBotAuthNonceCheck(nonce, ttlMs)` to reject replayed signatures. It works like `consumeNonce`. The signed `@authority` has to match the host in `url`. If a proxy rewrites `url` to an internal address, pass your public host as `webBotAuthAuthority`.

`behaviorReplayCheck(digest, ttlMs)` works the same way for behavior traces. Return `true` if the digest was seen before, and the trace gets `bh_replayed`. Only traces with 8 or more pointer moves and key presses have a digest.

With behavior on, a successful result has `behavior: { score, verdict, flags, signals, agent }`. With it off, `agent` is returned at the top level whenever there's evidence, built from page marks and headers only, and it's never blocked. Either way, a detected agent adds `agent:<name>` to `riskFlags`. `agent` looks like this:

```js
{
  detected: true,
  name: "claude-in-chrome",
  confidence: "high",
  verified: false,
  evidence: ["artifact:cic_active"],
}
```

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
| `instrumentationGenerator` | `generateInstrumentation` | Async function that generates the instrumentation script. |
| `behavior` | `false` | See [behavior and agents](#behavior-and-agents). |
| `format`, `protocols` | format 1 | See [HashWX](#format-2-hashwx). |
| `hashwxDifficulty`, `hashwxChallengeCount`, `hashwxNoncesPerHash` | see [HashWX](#format-2-hashwx) | HashWX settings for format 2. |
| `keypair`, `t`, `rsw` | none | Settings for the deprecated RSW protocol. |

Format 1 returns `{ challenge, token, expires, instrumentation? }`, and format 2 returns `{ token, format: 2, challenges, expires }`. Both add `behavior: true` when behavior scoring is on. Send the whole object to the widget.

### `validateChallenge(secret, body, options?)`

`body` is what the widget posts to `/redeem`. The options are:

| Option | Default | What it does |
| --- | --- | --- |
| `consumeNonce` | none | See [replay prevention](#replay-prevention). |
| `scope` | none | Must match the challenge's scope. |
| `tokenTtlMs` | `1_200_000` | How long the visitor's token stays valid. |
| `signToken` | `id:secret` | Function that receives `{ scope, expires, iat }` and returns your own token. `tokenKey` is left out. |
| `request` | none | The `/redeem` request as `{ method, url, headers }`. See [behavior and agents](#behavior-and-agents). |
| `verifyWebBotAuth` | `false` | Verifies Web Bot Auth signatures on `request`. |
| `fetch` | global `fetch` | Used to download Web Bot Auth key directories. |
| `trustedSignatureAgents` | none | Extra signer origins to trust, like `"https://agent.example.com"`. |
| `webBotAuthNonceCheck` | none | Rejects replayed Web Bot Auth signatures. |
| `webBotAuthAuthority` | host of `request.url` | Host that Web Bot Auth signatures have to cover. |
| `behaviorReplayCheck` | none | Flags replayed behavior traces. |

On success it returns `{ success: true, token, tokenKey, expires, scope, iat, riskFlags }`, plus `behavior` or `agent` as described in [behavior and agents](#behavior-and-agents). `riskFlags` lists signals that don't block on their own, like `native_tamper` or `legacy_widget`, so you can raise the difficulty for that visitor. The instrumentation page lists the [browser check flags](./instrumentation.md#automated-browser-detection) and the [behavior flags](./instrumentation.md#behavior-scoring).

On failure it returns `{ success: false, reason }`. Instrumentation failures also have `instr_error: true`, `instr_automated_browser` and `instr_automated_interaction` have a `blockedBy` list, and behavior failures have `behavior`. Every `reason` is listed in the [error codes table](./error-codes.md).

### Lower-level exports

capd and the tests use these. You only need them to build your own pipeline.

| Export | What it does |
| --- | --- |
| `generateInstrumentation(opts?)` | Generates an instrumentation script and the metadata to check it. |
| `verifyInstrumentationResult(meta, payload, now?)` | Checks a result against that metadata. Returns `{ valid, reason?, riskFlags?, blockedBy?, checks?, agent?, trace? }`. |
| `serializeBound(data)`, `canonicalize(value)` | Serialize collected data the way the script does. |
| `boundValues(binding, serialized)` | The numbers a result has to contain for that data. |
| `MAX_BOUND_DATA` | Longest serialized data accepted, 65,536 characters. |
| `detectAutomation(vector)` | Runs the automated browser checks on browser facts you collected yourself. Returns `{ pass, checks, blockedBy, riskFlags }`. |
| `analyzeBehavior(trace, ctx?)` | Scores a behavior trace. `ctx` takes `{ replayed, strict, threshold }`. Returns `{ score, verdict, flags, signals, digest }`. |
| `BEHAVIOR_WEIGHTS`, `DEFAULT_BEHAVIOR_THRESHOLD`, `WEAK_CAP` | The flag weights, `0.75` and `0.6`. |
| `agentFromHeaders(headers)` | Agent evidence from `User-Agent`, `Signature-Agent` and `Sec-CH-UA-Platform`. |
| `agentFromTrace(trace)` | Agent evidence from a behavior trace's click and typing timing. Only pass traces that `analyzeBehavior` didn't flag as `bh_malformed`. |
| `summarizeAgent(evidence, verification?)` | Combines evidence, and an optional `verifyWebBotAuth` result, into the `agent` object, or `null` if there's no evidence. |
| `verifyWebBotAuth(req, opts?)` | Verifies a Web Bot Auth signature. Resolves to `{ verified, agent?, origin?, keyid?, reason? }`. |
| `parseSignatureAgent(value)` | Parses a `Signature-Agent` header into `{ label, url }` entries. |
| `hashwxReady()`, `setHashwxModule(module)` | Compile the HashWX module early, or supply one. See [HashWX](#format-2-hashwx). |
| `hashwxTarget(difficulty)`, `hashwxSeed(challenge, block)`, `hashwxHash(state, seed, nonce)` | HashWX primitives. `state` comes from `hashwxReady()`. |
| `DEFAULT_HASHWX_DIFFICULTY`, `DEFAULT_HASHWX_CHALLENGE_COUNT`, `DEFAULT_HASHWX_NONCES_PER_HASH` | `1_000_000`, `4` and `65_536`. |
| `generateRswKeypair(bits?)`, `serializeRswKeypair(kp)`, `deserializeRswKeypair(s)`, `buildRswMinter(args, opts?)` | Keys and minters for the deprecated RSW protocol. |

## Migrating from `@cap.js/server` {#how-it-differs-from-cap-js-server}

`@cap.js/server` is the older library, superseded by this one. It kept challenges and tokens in storage you configured. `capjs-core` keeps nothing. Challenges are signed JWTs, replay prevention goes through `consumeNonce`, and you store `tokenKey` yourself as shown in [verifying tokens](#verifying-tokens). It never touches the filesystem, so it runs on Workers and Lambda.
