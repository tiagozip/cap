# Benchmark

This benchmark compares the historical Rust solver from commit `da725dba93f61099d264bc597d22ff388d09d2ad` against the current C solver at `HEAD`.

## What it does

- Rebuilds the Rust implementation from `benchmark/rust`
- Rebuilds the current C implementation from `src/c`
- Loads both Node targets
- Verifies the same challenge cases before timing them
- Reports average time per solve and the relative speedup

## Run it

```bash
bun --cwd benchmark run bench
```

Optional environment variables:

- `BENCH_ITERATIONS` controls the timed loops, default `10`
- `BENCH_WARMUP` controls warmup rounds, default `2`

## Requirements

- `make`
- `clang`
- `git`
- `rustup`
- the `wasm32-unknown-unknown` target installed for the rustup-managed toolchain
