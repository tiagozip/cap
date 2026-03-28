import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const rustupBin = path.join(process.env.HOME ?? "", ".cargo", "bin", "rustup");
const rustcBin = path.join(process.env.HOME ?? "", ".cargo", "bin", "rustc");
const rustBaselineCommit = "da725dba93f61099d264bc597d22ff388d09d2ad";
const outDir = path.join(__dirname, "out");
const headDir = path.join(outDir, "head");
const headBuildDir = path.join(headDir, "build");
const headBrowserDir = path.join(headDir, "browser");
const headLoaderSrc = path.join(rootDir, "src", "node", "cap_wasm.js");
const headLoaderDest = path.join(headDir, "cap_wasm.js");
const headWasm = path.join(headDir, "cap_wasm_bg.wasm");
const rustDir = path.join(outDir, "rust");
const rustSrcDir = path.join(__dirname, "rust");

const challengeCases = [
  ["e455cea65e98bc3c36287f43769da211", "dceb", 63625],
  ["fb8d25f6abac5aa9b6360051f37e010b", "93f1", 62420],
  ["91ef47db578fbeb2565d3f9c82bb7960", "3698", 42515],
  ["b7ad7667486a691cda8ef297098f64a7", "d72a", 32395],
  ["1aca3fb7cef7a2be0dee563ed4136758", "3b58", 53368],
  ["d9ec39af92b430e5a329274d8aa58fa8", "e1d3", 52431],
  ["781a3cc9217d73c908a321d3fdabd62f", "22c6", 102156],
  ["e37a0752c9ac2f3d2517747fde373ac9", "f6f1", 118925],
  ["bba070197569f322beda5b240f639a95", "4751", 25523],
  ["89297515aeac646bee9653ba405e0beb", "a7de", 47980],
  ["444571a0d5039c15be6141d6cd8434f9", "a783", 38735],
  ["ba75f2bf8e9b92cc32caa17237a52d14", "7e30", 67790],
  ["22bfc18ba8e3ecee080c5d1ef64ed6e9", "5fcf", 14836],
  ["885fb78ff76b4eddd2f5bc04ac5ee673", "93e5", 91445],
  ["308758072931bb3b254a7b1ed351d04a", "3e49", 19889],
  ["724f89bb167db4b881e1dc7b0949ac8f", "b82e", 28170],
  ["8b79506e4630de15be225c18623eff65", "f0e5", 9820],
  ["0c21ade6e63a4e37b13cb8b087f31863", "65c9", 190704],
];

const iterations = Number.parseInt(process.env.BENCH_ITERATIONS ?? "10", 10);
const warmupRounds = Number.parseInt(process.env.BENCH_WARMUP ?? "2", 10);

if (!Number.isFinite(iterations) || iterations < 1) {
  throw new Error("BENCH_ITERATIONS must be a positive integer");
}

if (!Number.isFinite(warmupRounds) || warmupRounds < 0) {
  throw new Error("BENCH_WARMUP must be a non-negative integer");
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function loadSolvePow(modulePath) {
  const require = createRequire(import.meta.url);
  const mod = require(modulePath);

  if (typeof mod.solve_pow !== "function") {
    throw new Error(`missing solve_pow in ${modulePath}`);
  }

  return mod.solve_pow;
}

function verifySolver(label, solvePow) {
  for (const [salt, target, expectedNonce] of challengeCases) {
    const actualNonce = solvePow(salt, target).toString();

    if (actualNonce !== String(expectedNonce)) {
      throw new Error(
        `${label} mismatch for ${salt}:${target} - expected ${expectedNonce}, got ${actualNonce}`,
      );
    }
  }
}

function benchmarkSolver(label, solvePow) {
  for (let round = 0; round < warmupRounds; round += 1) {
    for (const [salt, target] of challengeCases) {
      solvePow(salt, target);
    }
  }

  const start = performance.now();
  let checksum = 0n;

  for (let round = 0; round < iterations; round += 1) {
    for (const [salt, target] of challengeCases) {
      checksum ^= solvePow(salt, target);
    }
  }

  const elapsedMs = performance.now() - start;
  const totalCalls = iterations * challengeCases.length;

  return {
    label,
    checksum,
    elapsedMs,
    perSolveMs: elapsedMs / totalCalls,
  };
}

function buildHead() {
  resetDir(headDir);
  fs.mkdirSync(headBrowserDir, { recursive: true });

  execFileSync(
    "make",
    [
      "-C",
      path.join(rootDir, "src", "c"),
      `BUILD_DIR=${headBuildDir}`,
      `OUT=${path.join(headBuildDir, "cap_wasm.wasm")}`,
      `NODE_WASM=${headWasm}`,
      `BROWSER_WASM=${path.join(headBrowserDir, "cap_wasm_bg.wasm")}`,
    ],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  fs.copyFileSync(headLoaderSrc, headLoaderDest);
}

function buildRust() {
  resetDir(rustDir);

  execFileSync(
    rustupBin,
    [
      "run",
      "stable",
      "cargo",
      "build",
      "--manifest-path",
      path.join(rustSrcDir, "Cargo.toml"),
      "--target",
      "wasm32-unknown-unknown",
      "--release",
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: path.join(rustDir, "target"),
        RUSTC: rustcBin,
      },
      stdio: "inherit",
    },
  );

  const rustWasmSource = path.join(
    rustDir,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "cap_wasm.wasm",
  );

  const rustLoader = execFileSync(
    "git",
    ["show", `${rustBaselineCommit}:wasm/src/node/cap_wasm.js`],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  const rustLoaderWithStubs = rustLoader.replace(
    "imports = {};",
    [
      "imports = {};",
      "module.exports.__wbindgen_describe = function () {};",
      "module.exports.__wbindgen_externref_xform__ = {",
      "  __wbindgen_externref_table_set_null: function () {},",
      "  __wbindgen_externref_table_grow: function () { return 0; },",
      "};",
      "imports.__wbindgen_externref_xform__ = module.exports.__wbindgen_externref_xform__;",
    ].join("\n"),
  ).replace(
    "wasm.__wbindgen_start());",
    "wasm.__wbindgen_start && wasm.__wbindgen_start());",
  );

  fs.writeFileSync(path.join(rustDir, "cap_wasm.js"), rustLoaderWithStubs);
  fs.copyFileSync(rustWasmSource, path.join(rustDir, "cap_wasm_bg.wasm"));
}

buildHead();
buildRust();

const headSolvePow = loadSolvePow(path.join(headDir, "cap_wasm.js"));
const rustSolvePow = loadSolvePow(path.join(rustDir, "cap_wasm.js"));

verifySolver("HEAD (C)", headSolvePow);
verifySolver(`Rust (${rustBaselineCommit.slice(0, 7)})`, rustSolvePow);

const headResult = benchmarkSolver("HEAD (C)", headSolvePow);
const rustResult = benchmarkSolver(`Rust (${rustBaselineCommit.slice(0, 7)})`, rustSolvePow);

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
