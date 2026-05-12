---
outline: [2, 3]
---

# RSW time-lock puzzles

Newer versions of Cap add an experimental challenge type called **RSW** (Rivest-Shamir-Wagner) **time-lock puzzle**. It exists as a more GPU-resistant alternative to the default SHA-256 proof-of-work.

::: tip
RSW is **opt-in**. The default Cap pipeline keeps using SHA-256 PoW. Existing widgets and servers don't change behaviour unless you [explicitly enable it](./capjs-core.md#format-2-rsw-opt-in).
:::

## Why RSW

Cap's default SHA-256 PoW is fast and cheap to verify, but each puzzle can be theoretically accelerated by GPUs or ASICs. We haven't seen this in the wild yet, but as GPUs get cheaper and more accessible, the security margin of hash-based PoW erodes.

RSW is a sequential puzzle. It is designed to be resistant to GPU acceleration. We're currently still testing and benchmarking it before it's ready for production use, but so far the results are quite promising.

In fact, from our tests, RSW is **slower** on an A100 than on a modern phone like an iPhone Air. We benchmarked this on a few rented GPUs (with NVIDIA's own [CGBN](https://github.com/NVlabs/CGBN) library) and consumer devices:

| Hardware | µs / 2048-bit squaring (single chain) |
|---|---:|
| Apple M3 Air, Chrome 148 | **2.39** |
| Apple iPhone Air, iOS 26 + Chrome | 3.07 |
| Pixel 9, Chrome 145 | 5.14 |
| iPhone 12, iOS 17 (WebKit) | 8.57 |
| **NVIDIA H100, 32 threads cooperating on one chain** | **2.70** |
| NVIDIA L4, 32 threads cooperating | 2.69 |
| NVIDIA A100, 32 threads cooperating | 4.82 |

## How the protocol works

### Setup (once at boot)

The server generates a 2048-bit RSA-style modulus `N = p·q`. It keeps `p` and `q` secret, publishes only `N`. The keypair generation takes ~0.5–3 seconds depending on prime-roll luck, so the server should persist the result and reuse it across processes.

### Per-challenge mint (≈ 2 ms)

Naively, minting a challenge would require the server to compute `y = x^(2^t) mod N` from scratch, the same expensive work the client does. We avoid this with the short-exponent trick:

1. At setup, the server precomputes `h = g^(2^t) mod N` once using the trapdoor `φ(N) = (p-1)(q-1)`. This is **one** full-strength modexp.
2. For each challenge, the server picks a random 256-bit scalar `r`, then computes:
   - `x = g^r mod N`
   - `y = h^r mod N`
3. Algebraically, `x^(2^t) = (g^r)^(2^t) = (g^(2^t))^r = h^r = y`

Both `g^r` and `h^r` are 256-bit-exponent modexps, ~4 short multiplications each. With Chinese-remainder-theorem speedup over `p` and `q`, the whole mint takes about 2 milliseconds on a modern CPU.

The client only sees `(N, x, t)`. Recovering `r` from `x` is discrete log in `(Z/N)*`, as hard as factoring `N`. The 256-bit exponent doesn't expose a shortcut (no known sub-exponential attack on DLP in a 2048-bit-modulus subgroup with short exponent).

### Client solve

All the client needs to do, given `(N, x, t)`, is to compute:

```js
let y = x;
for (let i = 0; i < t; i++) y = (y * y) % N;
```

This takes about ~300-800ms on most hardware.

### Server verify (≈ 100 µs)

The server's encrypted-state token already contains the expected `y` (placed there at mint time). Verification is a constant-time `BigInt` compare against the submitted `y`. No re-derivation required.

## What RSW does *not* protect against

RSW doesn't protect against FPGA / ASIC hardware. Custom silicon can do a 2048-bit modular square in 50–100 ns (~15-20× a CPU core) on FPGA, single-digit ns (~200-300×) on ASIC. The economics still don't make sense for CAPTCHA farming since custom ASICs cost millions in NRE, but if your threat model includes nation-state-class attackers, you're probably fucked.

## Trying it

The cap-core API surface for RSW is documented in [RSW challenges](./capjs-core.md#format-2-rsw-opt-in). The widget auto-detects format-2 responses, so a same-binary upgrade on the server is enough.