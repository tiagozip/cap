---
description: "Cap CAPTCHA benchmark: SHA-256 proof-of-work solve times across low-end to high-end devices, measured in real browsers."
---

# Benchmark

This page benchmarks SHA-256 proof of work in your browser. For HashWX, the default protocol, see the [desktop and phone measurements](./hashwx.md#cost).

<Benchmark />

## Results

SHA-256 at difficulty 4 with 50 challenges, on `@cap.js/wasm` 0.0.7, against a placeholder server:

| Device | Time |
| --- | ---: |
| Samsung Galaxy A34 | 795 ms |
| iPhone SE (2020) | 798 ms |
| Google Pixel 7 | 423 ms |
| Google Pixel 9 | 414 ms |
| MacBook, M3 | 212 ms |
