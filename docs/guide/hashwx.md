---
outline: [2, 3]
description: "HashWX is Cap's GPU-resistant proof of work. Each challenge generates a fresh hash function, so a GPU gains about 2x over a CPU instead of 150x."
---

# HashWX

HashWX is Cap's default proof of work. Where SHA-256 uses one fixed hash function, HashWX generates a new one for every block of nonces, built from integer operations and branches that GPUs run poorly. It was designed by [tevador](https://github.com/tevador/hashwx), who also wrote RandomX, and his [design document](https://github.com/tevador/hashwx/blob/master/doc/design.md) explains how it works. Cap uses his reference WebAssembly build.

It's the default for new keys in capd. In the core library it's [opt-in](./capjs-core.md#format-2-hashwx).

## Why not SHA-256

What matters for bot protection is how many challenges an attacker clears per hour, not how long one takes. A GPU runs a fixed function like SHA-256 on thousands of lanes at once. Cap used RSW time-lock puzzles before HashWX, which can't be parallelised within one puzzle, but a GPU still runs thousands of separate puzzles side by side. Measured against a consumer GPU:

| Algorithm | CPU, Ryzen 3700X, 16 threads | GPU, RTX 5060 Ti | GPU advantage |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| HashWX | 2.8 MH/s | 5.8 MH/s | ~2x |

The figures are tevador's, from his own unpublished CUDA implementation. Cap reproduced the RSW row: an M3 does 2.11 H/s per thread, which works out to 26 H/s on 16 Ryzen threads.

RSW is deprecated. capd now serves HashWX to keys that were set to RSW. The core library still issues RSW challenges when you ask for them, but don't pick it for new setups.

## Cost

Server time per challenge on one Apple M3 core, median of 200 mints and 40 verifications:

| Protocol | Mint | Verify | Total |
|---|---:|---:|---:|
| HashWX, 1 challenge | 14 µs | 40 µs | 54 µs |
| HashWX, 4 sub-challenges (default) | 20 µs | 129 µs | 149 µs |
| SHA-256, 50 challenges at difficulty 4 | 4 µs | 83 µs | 87 µs |
| RSW, t = 75,000 | 1522 µs | 14 µs | 1536 µs |

Difficulty doesn't change these numbers, since verifying is one hash per sub-challenge however long it took to find.

On the client, one challenge has a random solve time: the same difficulty can take 30 ms for one visitor and 3 s for the next. Cap splits the difficulty into four sub-challenges by default, which evens it out. Measured through the widget in Chrome on an 8-core M3, 72 solves each, with the two difficulties set for about the same median:

| | 1 challenge, d = 1,330,000 | 4 sub-challenges, d = 1,000,000 |
|---|---:|---:|
| Median | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| Slowest of 72 | 2378 ms | 1490 ms |

The right column is the default. Against a capd key it measured a 578 ms median and a 0.9 s p90. Splitting doesn't change what an attacker pays, since the expected work is `d` hashes either way.

### Browsers

The WebAssembly build runs at about 60% of native speed. Measured on the same M3:

| Browser | 1 worker | 8 workers | Interpreted fallback |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

Safari reaches about 70% of Chrome's speed on all cores, so tune difficulty against Safari. At the default, that's about 0.5 s on Chrome and 0.7 s on Safari.

If you measure this yourself, use release builds with the tab in front. Playwright's Firefox runs all WebAssembly three to six times slower than real Firefox, and a background tab can end up on efficiency cores.

### Phones

The default difficulty on real phones through BrowserStack, 15 solves each and 30 on the Vivo, each starting from a freshly loaded page:

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

Each solve includes two round trips to the test server, 80 to 190 ms each. A page that had already been running HashWX for a minute solved 24% to 29% faster, so benchmarks that warm up first look better than what visitors get.

If most of your traffic is mobile, lower the difficulty. Solve time scales with it, so 500,000 roughly halves the solving part of these numbers.

HashWX needs WebAssembly, and iOS 15 or newer on iPhones. For browsers without WebAssembly, use SHA-256, which has a JavaScript fallback.

## Limits

Custom hardware would still beat a CPU. An FPGA or ASIC built for HashWX costs millions to design, which makes no sense for solving CAPTCHAs, but that's an economic argument and not a cryptographic one.

It doesn't stop people paid to solve challenges by hand either. Pair it with [instrumentation](./instrumentation.md) so a real browser is required too.
