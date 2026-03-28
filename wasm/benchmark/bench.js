import path from "node:path";
import { createRequire } from "node:module";
import { buildAll, headDir, rustDir } from "./build-artifacts.js";
import { benchmarkSolver, rustBaselineCommit, verifySolver } from "./shared.js";

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? "10", 10);
const warmupRounds = Number.parseInt(process.env.BENCH_WARMUP ?? "2", 10);

if (!Number.isFinite(iterations) || iterations < 1) {
  throw new Error("BENCH_ITERATIONS must be a positive integer");
}

if (!Number.isFinite(warmupRounds) || warmupRounds < 0) {
  throw new Error("BENCH_WARMUP must be a non-negative integer");
}

function loadSolvePow(modulePath) {
  const require = createRequire(import.meta.url);
  const mod = require(modulePath);

  if (typeof mod.solve_pow !== "function") {
    throw new Error(`missing solve_pow in ${modulePath}`);
  }

  return mod.solve_pow;
}

buildAll();

const headSolvePow = loadSolvePow(path.join(headDir, "cap_wasm.js"));
const rustSolvePow = loadSolvePow(path.join(rustDir, "cap_wasm.js"));

verifySolver("HEAD (C)", headSolvePow);
verifySolver(`Rust (${rustBaselineCommit.slice(0, 7)})`, rustSolvePow);

const headResult = benchmarkSolver("HEAD (C)", headSolvePow, {
  iterations,
  warmupRounds,
});
const rustResult = benchmarkSolver(`Rust (${rustBaselineCommit.slice(0, 7)})`, rustSolvePow, {
  iterations,
  warmupRounds,
});

if (headResult.checksum !== rustResult.checksum) {
  throw new Error(
    `checksum mismatch: ${headResult.checksum.toString()} != ${rustResult.checksum.toString()}`,
  );
}

console.log(`\nBenchmark results`);
console.log(
  `${headResult.label.padEnd(14)} ${headResult.elapsedMs.toFixed(2)} ms total ` +
    `(${headResult.perSolveMs.toFixed(4)} ms/solve)`,
);
console.log(
  `${rustResult.label.padEnd(14)} ${rustResult.elapsedMs.toFixed(2)} ms total ` +
    `(${rustResult.perSolveMs.toFixed(4)} ms/solve)`,
);
console.log(
  `Speedup: ${(rustResult.perSolveMs / headResult.perSolveMs).toFixed(2)}x faster on HEAD`,
);
