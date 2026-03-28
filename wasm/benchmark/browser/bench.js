import { benchmarkSolver, challengeCases, rustBaselineCommit, verifySolver } from "../shared.js";

const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const outputEl = document.getElementById("output");

function log(line) {
  outputEl.textContent += `${line}\n`;
  console.log(line);
}

function fail(error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  statusEl.textContent = "Failed.";
  outputEl.textContent += `${message}\n`;
  console.error(error);
}

window.addEventListener("error", (event) => {
  fail(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  fail(event.reason);
});

function readIntParam(name, fallback) {
  const value = new URLSearchParams(location.search).get(name);

  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return parsed;
}

const iterations = readIntParam("iterations", 10);
const warmupRounds = readIntParam("warmup", 2);

metaEl.textContent = `iterations=${iterations}, warmup=${warmupRounds}, cases=${challengeCases.length}`;

try {
  const cacheToken = Date.now();
  const headModule = await import(`/out/head/browser/cap_wasm.js?cache=${cacheToken}`);
  const rustModule = await import(`/out/rust/browser/cap_wasm.js?cache=${cacheToken}`);

  const initHead = headModule.default;
  const headSolvePow = headModule.solve_pow;
  const initRust = rustModule.default;
  const rustSolvePow = rustModule.solve_pow;

  statusEl.textContent = "Loading wasm modules...";
  log("Loading wasm modules...");
  await Promise.all([initHead(), initRust()]);
  log("Wasm modules loaded.");

  statusEl.textContent = "Verifying solver outputs...";
  log("Verifying solver outputs...");
  await new Promise((resolve) => requestAnimationFrame(resolve));

  verifySolver("HEAD (C)", headSolvePow);
  verifySolver(`Rust (${rustBaselineCommit.slice(0, 7)})`, rustSolvePow);
  log("Verification complete.");

  statusEl.textContent = "Running benchmark...";
  log("Running benchmark...");
  await new Promise((resolve) => requestAnimationFrame(resolve));

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

  log("Benchmark results");
  log(
    `${headResult.label.padEnd(14)} ${headResult.elapsedMs.toFixed(2)} ms total ` +
      `(${headResult.perSolveMs.toFixed(4)} ms/solve)`,
  );
  log(
    `${rustResult.label.padEnd(14)} ${rustResult.elapsedMs.toFixed(2)} ms total ` +
      `(${rustResult.perSolveMs.toFixed(4)} ms/solve)`,
  );
  log(`Speedup: ${(rustResult.perSolveMs / headResult.perSolveMs).toFixed(2)}x faster on HEAD`);

  statusEl.textContent = "Done.";
} catch (error) {
  fail(error);
}
