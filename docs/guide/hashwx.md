---
outline: [2, 3]
description: "HashWX is Cap's GPU-resistant proof of work. Each challenge generates a fresh hash function, so a GPU gains about 2x over a CPU instead of 150x."
---

# HashWX proof of work

**HashWX** is Cap's default challenge protocol. Instead of a fixed hash function like SHA-256, every challenge generates a **new** one-way function from a seed, built out of integer operations and branches chosen so that a GPU cannot run it much faster than a CPU.

It was designed by [tevador](https://github.com/tevador/hashwx), who also wrote RandomX and HashX. Cap vendors the reference WebAssembly build.

::: tip
HashWX is the default for new Standalone keys. In cap-core it is opt-in through the format-2 API, and SHA-256 proof of work stays the default there. See [HashWX challenges](./capjs-core.md#format-2-hashwx).
:::

## Why HashWX

The problem with SHA-256 proof of work is throughput. A GPU runs the same fixed function across thousands of lanes in lockstep, so it solves far more challenges per second than a CPU. That is the metric that matters for bot protection: an attacker does not care how long one challenge takes, only how many they can clear per hour.

Cap previously shipped RSW time-lock puzzles for this. RSW wins on **latency**, since sequential squaring cannot be parallelised within one puzzle, but it loses badly on **throughput**, because a GPU can run thousands of independent puzzles at once. Measured against a consumer GPU:

| Algorithm | CPU, Ryzen 3700X, 16 threads | GPU, RTX 5060 Ti | GPU advantage |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| **HashWX** | **2.8 MH/s** | **5.8 MH/s** | **~2x** |

Those figures are tevador's, using his own non-public CUDA implementation. We reproduced the RSW row independently: an M3 measures 2.112 H/s per thread, which lands on 26 H/s for 16 Ryzen threads.

RSW is deprecated. It is still selectable per key, and existing keys keep working, but it should not be used for new deployments.

## How the protocol works

### Mint

The server picks 32 random bytes as the challenge `C` and a difficulty `d`. There is no key material and no precomputation, so minting is a random read and a JWT sign.

The client is given `C`, `d`, and `n`, the number of nonces each generated function covers.

### Client solve

The client finds a 64-bit nonce `N` such that

```
H(N) <= (2^64 - 1) / d      where H = hashwx_make(sha256(C || u64le(N / n)))
```

Each block of `n` consecutive nonces shares one generated hash function. The client builds that function, runs it over the block, and moves to the next block if nothing lands under the target. Expected work is `d` hashes.

Cap uses `n = 65536`. The reference protocol uses 463 for native clients; in a browser the function has to be JIT-compiled through `WebAssembly.Module` for every block, so a larger block amortises that cost. tevador notes the tradeoff explicitly: more nonces per function makes the protocol somewhat more susceptible to JIT-compiled GPU kernels, and divergent branching is what still carries the GPU resistance at that setting. The ~2x figure above is measured at 65536, so it already accounts for this.

### What makes it GPU-resistant

Four properties, all from the [design document](https://github.com/tevador/hashwx/blob/master/doc/design.md):

Each instance is 32 programs, each a loop that branches back to its own start with probability 1/2, which works out to exactly 256 branches per hash. On a CPU that is a handful of mispredictions. On a GPU it splits a warp into divergent paths that have to be executed one after another.

There is a 16 KB scratchpad and its loads are deliberately unaligned. A CPU keeps it in L1 and hides the 3 to 4 cycle latency by reordering. A GPU has to keep it in local memory backed by L2 at around 100 cycles, and most GPU architectures have to emulate unaligned loads by combining two adjacent ones.

Source registers are drawn from interleaved "shallow" and "deep" lists, so a CPU handles 2.75 dependent loads on average. A GPU interpreter has to specialise for the deep list, because in about 95% of cases at least one thread in a warp is running a deep program, so it eats the full chain of 6 dependent loads every time.

The instruction set is restricted to what WebAssembly 1.0 offers: 64-bit multiply, add, subtract, XOR, OR, rotate and shift, with 6-bit immediates. That is what lets the same algorithm run in a browser at all.

### Server verify

The server recomputes the seed from `C` and the block index implied by the submitted nonce, generates that one hash function, runs it once, and compares against the target. Program generation is about 5x cheaper than HashX, which is what keeps verification in the tens of microseconds.

## Cost

Server cost per challenge, measured on one core of an Apple M3, median over 200 mints and 40 verifications through `validateChallenge`:

| Protocol | Mint | Verify | Total |
|---|---:|---:|---:|
| **HashWX**, 1 challenge | **14 µs** | **40 µs** | **54 µs** |
| **HashWX**, 4 sub-challenges (default) | **20 µs** | **129 µs** | **149 µs** |
| SHA-256 (50 challenges, difficulty 4) | 4 µs | 83 µs | 87 µs |
| RSW (t = 75,000) | 1522 µs | 14 µs | 1536 µs |

A single HashWX challenge is the cheapest round trip of the three. The default of four sub-challenges costs about 150 µs, more than SHA-256 but a tenth of RSW, which pays for four real modular exponentiations on every mint. Difficulty does not change these numbers: verifying is one hash per sub-challenge however hard it was to find.

Client cost is the other side of that trade. One challenge on its own has an exponentially distributed solve time, which makes it a lottery: the same difficulty takes 30 ms for one visitor and three seconds for the next. So by default Cap splits the difficulty into four sub-challenges, which evens the solve time out. Measured through the widget in release Chrome on an M3 with 8 cores, 72 solves each, with the two difficulties tuned to about the same median:

| | 1 challenge, d = 1,330,000 | 4 sub-challenges, d = 1,000,000 |
|---|---:|---:|
| Median | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Slowest of 72 | 2378 ms | 1490 ms |

The right-hand column is the default. Against a Standalone key it measured a 578 ms median and a 0.9 s p90.

Splitting does not change what an attacker pays for a given difficulty, since the expected work is `d` hashes however it is cut. What changes is the shape. The median of one challenge sits at 0.69 of its mean, while four sub-challenges put it at about 0.92 of the mean and shorten the tail. At the same difficulty, then, the split makes the typical solve about a third slower and cuts the p90 by about a quarter. The table holds the median fixed instead, which puts the split at 25% less difficulty and gives an attacker 25% less work per solve. The widget's own overhead is small. Its workers check for a stop every 16 ms, which bounds how long a handoff between sub-challenges can take.

### Browser engines

The wasm build runs at roughly 60% of native speed. The three major engines are close on a single worker, and Safari falls behind once every core is busy. Measured on the same M3 in one session, with each browser headless or in front:

| Engine | 1 worker | 8 workers | Interpreted fallback |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

On one worker all three are within 5% of each other. On eight, Safari reaches about 70% of Chrome's rate, so tune the difficulty against Safari: at d = 1,000,000 that is a mean of about 0.5 s on Chrome and 0.7 s on Safari.

If you benchmark this yourself, measure a release build of each browser with the tab in front. Playwright's bundled Firefox runs every WebAssembly workload three to six times slower than release Firefox, not just HashWX, and a backgrounded tab can land on the efficiency cores and halve every number.

### Phones

The default on real phones through BrowserStack, 15 solves each and 30 on the Vivo. Every run started on a freshly loaded page, the way a visitor arrives. Once the page had already run HashWX for a minute, the Pixel 6 took 24% less time per solve and the Vivo 29% less, so a benchmark that warms up first will look better than this.

| Device | OS | All cores | Median | Slowest |
|---|---|---:|---:|---:|
| Galaxy S24 | Android 14 | 1238 KH/s | 1.1 s | 1.8 s |
| Pixel 9 | Android 15 | 837 KH/s | 1.4 s | 2.0 s |
| Pixel 6 | Android 12 | 746 KH/s | 1.9 s | 2.4 s |
| iPhone 15 | iOS 17 | not measured | 1.9 s | 4.3 s |
| iPhone 12 | iOS 17 | 620 KH/s | 2.0 s | 3.3 s |
| iPhone 13 | iOS 15 | 678 KH/s | 2.2 s | 4.1 s |
| iPhone SE 2022 | iOS 15 | 588 KH/s | 2.4 s | 4.0 s |
| Redmi Note 11 | Android 11 | 456 KH/s | 2.4 s | 4.8 s |
| Galaxy M32 | Android 11 | 444 KH/s | 2.8 s | 6.1 s |
| Vivo Y21 | Android 11 | 316 KH/s | 5.9 s | 11.0 s |

Each solve includes two round trips to the test server, with a median of 80 to 190 ms per device. The Vivo, a budget Android, takes about ten times as long as the M3 desktop. If most of your traffic is mobile, lower the difficulty. Solve time scales linearly with it, so 500,000 roughly halves the solving part of every number here.

Clients without WebAssembly cannot solve HashWX at all and will get an error. If you need to support them, use SHA-256 proof of work, which has a pure-JS fallback. On iPhones the widget needs iOS 15 or newer.

## What HashWX does not protect against

The same thing RSW did not: custom silicon. An FPGA or ASIC built for this would still beat a CPU. The economics do not work for CAPTCHA farming, since an ASIC costs millions in non-recurring engineering, but it is not a cryptographic guarantee.

It also does not stop a human solving farm, and it never will. Proof of work raises the cost per request. Pair it with [instrumentation challenges](./instrumentation.md) so that a real browser environment is required as well.

## Trying it

The cap-core API is documented in [HashWX challenges](./capjs-core.md#format-2-hashwx). The widget auto-detects format-2 responses, so upgrading the server is enough.

On [Cap Standalone](./standalone/options.md#hashwx-proof-of-work), HashWX is the default for new keys and can be switched per key in the dashboard.
