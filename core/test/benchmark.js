import { sha256Hex } from "../src/crypto.js";
import { generateChallenge, validateChallenge } from "../src/index.js";
import { prng } from "../src/prng.js";

const SECRET = "benchmark-secret-meow-meow-meow-meow";

async function bench(label, fn, opts = {}) {
  const warmup = opts.warmup ?? 1000;
  const ops = opts.ops ?? 20_000;
  for (let i = 0; i < warmup; i++) await fn(i);
  const t0 = Bun.nanoseconds();
  for (let i = 0; i < ops; i++) await fn(i);
  const ns = Bun.nanoseconds() - t0;
  const opsPerSec = (ops * 1e9) / ns;
  const nsPerOp = ns / ops;
  console.log(
    `${label.padEnd(60)} ${opsPerSec.toFixed(0).padStart(10)} ops/s   (${nsPerOp.toFixed(0)} ns/op)`,
  );
  return { opsPerSec, nsPerOp };
}

function solveChallenge(token, c, s, d) {
  const solutions = [];
  for (let i = 1; i <= c; i++) {
    const salt = prng(`${token}${i}`, s);
    const target = prng(`${token}${i}d`, d);
    let n = 0;
    while (true) {
      const hash = sha256Hex(salt + n);
      if (hash.startsWith(target)) {
        solutions.push(n);
        break;
      }
      n++;
    }
  }
  return solutions;
}

console.log("=== capjs-core benchmarks ===\n");
console.log(`bun ${Bun.version} on ${process.platform}/${process.arch}`);
console.log(`cpus: ${navigator.hardwareConcurrency}\n`);

await bench("generateChallenge (defaults: c=50 s=32 d=4)", () =>
  generateChallenge(SECRET),
);

await bench("generateChallenge (c=5 s=16 d=2)", () =>
  generateChallenge(SECRET, {
    challengeCount: 5,
    challengeSize: 16,
    challengeDifficulty: 2,
  }),
);

await bench("generateChallenge (c=200 s=64 d=4)", () =>
  generateChallenge(SECRET, {
    challengeCount: 200,
    challengeSize: 64,
    challengeDifficulty: 4,
  }),
);

await bench("generateChallenge (c=50 + scope)", () =>
  generateChallenge(SECRET, { scope: "test-scope" }),
);

console.log();
await bench(
  "generateChallenge + instrumentation (level=1)",
  () =>
    generateChallenge(SECRET, {
      challengeCount: 5,
      challengeSize: 16,
      challengeDifficulty: 2,
      instrumentation: { obfuscationLevel: 1 },
    }),
  { warmup: 5, ops: 100 },
);

await bench(
  "generateChallenge + instrumentation (level=3, default)",
  () =>
    generateChallenge(SECRET, {
      challengeCount: 5,
      challengeSize: 16,
      challengeDifficulty: 2,
      instrumentation: { obfuscationLevel: 3 },
    }),
  { warmup: 2, ops: 30 },
);

await bench(
  "generateChallenge + instrumentation (level=8)",
  () =>
    generateChallenge(SECRET, {
      challengeCount: 5,
      challengeSize: 16,
      challengeDifficulty: 2,
      instrumentation: { obfuscationLevel: 8 },
    }),
  { warmup: 1, ops: 10 },
);

console.log("\n--- validateChallenge ---\n");

const benchPub = await generateChallenge(SECRET, {
  challengeCount: 50,
  challengeSize: 32,
  challengeDifficulty: 4,
});
const benchSolutions = solveChallenge(
  benchPub.token,
  benchPub.challenge.c,
  benchPub.challenge.s,
  benchPub.challenge.d,
);
await bench("validateChallenge (c=50 s=32 d=4, valid)", () =>
  validateChallenge(SECRET, {
    token: benchPub.token,
    solutions: benchSolutions,
  }),
);

const smallPub = await generateChallenge(SECRET, {
  challengeCount: 5,
  challengeSize: 16,
  challengeDifficulty: 2,
});
const smallSolutions = solveChallenge(
  smallPub.token,
  smallPub.challenge.c,
  smallPub.challenge.s,
  smallPub.challenge.d,
);
await bench("validateChallenge (c=5 s=16 d=2, valid)", () =>
  validateChallenge(SECRET, {
    token: smallPub.token,
    solutions: smallSolutions,
  }),
);

const largePub = await generateChallenge(SECRET, {
  challengeCount: 200,
  challengeSize: 64,
  challengeDifficulty: 4,
});
const largeSolutions = solveChallenge(
  largePub.token,
  largePub.challenge.c,
  largePub.challenge.s,
  largePub.challenge.d,
);
await bench(
  "validateChallenge (c=200 s=64 d=4, valid)",
  () =>
    validateChallenge(SECRET, {
      token: largePub.token,
      solutions: largeSolutions,
    }),
  { warmup: 200, ops: 4_000 },
);

await bench("validateChallenge (invalid token, early reject)", () =>
  validateChallenge(SECRET, { token: "not.a.real.token", solutions: [] }),
);

const badToken = `${benchPub.token.split(".")[0]}.${benchPub.token.split(".")[1]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
await bench("validateChallenge (bad signature, HMAC reject)", () =>
  validateChallenge(SECRET, { token: badToken, solutions: [] }),
);

console.log("\n=== done ===");
