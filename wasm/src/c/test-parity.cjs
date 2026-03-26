const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

function build() {
  require("child_process").execFileSync("make", ["-C", "c"], { stdio: "inherit" });
}

function loadSolvePow(modulePath) {
  const mod = require(modulePath);
  if (typeof mod.solve_pow !== "function") {
    throw new Error(`missing solve_pow in ${modulePath}`);
  }
  return mod.solve_pow;
}

function lcg(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  };
}

function hexString(next, maxLen) {
  const hex = "0123456789abcdef";
  const len = next() % maxLen;
  let out = "";
  for (let i = 0; i < len; ++i) {
    out += hex[next() % hex.length];
  }
  return out;
}

function alphaString(next, maxLen) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const len = next() % maxLen;
  let out = "";
  for (let i = 0; i < len; ++i) {
    out += chars[next() % chars.length];
  }
  return out;
}

function compareCases(actual, reference, cases) {
  for (const [salt, target] of cases) {
    const actualNonce = actual(salt, target).toString();
    const referenceNonce = reference(salt, target).toString();
    if (actualNonce !== referenceNonce) {
      throw new Error(
        `mismatch for salt=${JSON.stringify(salt)} target=${JSON.stringify(target)} actual=${actualNonce} reference=${referenceNonce}`,
      );
    }
  }
}

async function main() {
  build();

  const actual = loadSolvePow(path.join("..", "node", "cap_wasm.js"));
  const referenceModule = await import(pathToFileURL(path.join(__dirname, "..", "browser", "cap_wasm.js")).href);
  referenceModule.initSync({
    module: fs.readFileSync(path.join(__dirname, "..", "browser", "cap_wasm_bg.wasm")),
  });
  const reference = referenceModule.solve_pow;

  const cases = [
    ["", ""],
    ["a", "0"],
    ["a", "00"],
    ["abc", "000"],
    ["hello", "f"],
    ["hello", "ff"],
    ["salt", "1"],
    ["salt", "abc"],
    ["mün", "0"],
  ];

  const next = lcg(0xC0FFEE);
  for (let i = 0; i < 40; ++i) {
    cases.push([alphaString(next, 8), hexString(next, 5)]);
  }

  compareCases(actual, reference, cases);
  console.log(`matched ${cases.length} cases`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
