# Benchmark

Press the button below to run a simple benchmark.

<Benchmark />

## Benchmark results

Using widget 0.1.25, WASM 0.0.6. These use a placeholder server, speeds might vary depending on your setup and network latency.

Note that solving might be significantly slower if you have your devtools open depending on what browser you're using. This is not intentional but is also not a bug with Cap.

| Tier      | Device             | Chrome | Safari |
| --------- | ------------------ | ------ | ------ |
| Low-end   | Samsung Galaxy A11 | 4.583s | -      |
| Low-end   | iPhone SE (2020)   | -      | 1.282s |
| Mid-range | Google Pixel 7     | 1.027s | -      |
| Mid-range | iPad (9th gen)     | –      | 1.401s |
| High-end  | Google Pixel 9     | 0.894s | –      |
| High-end  | MacBook Air M3     | 0.312s | 0.423s |

Tested with BrowserStack using the following configuration:

- **Challenge difficulty:** 4
- **Number of challenges:** 50
- **Salt/challenge size:** 32
- **Number of benchmarks:** 50
