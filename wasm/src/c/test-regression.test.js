import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { test, expect } from "bun:test";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function build() {
  execFileSync("make", ["-C", "c"], { stdio: "inherit" });
}

function loadSolvePow(modulePath) {
  const mod = require(modulePath);
  if (typeof mod.solve_pow !== "function") {
    throw new Error(`missing solve_pow in ${modulePath}`);
  }
  return mod.solve_pow;
}

async function loadBrowserSolvePow() {
  const browserModule = await import(
    pathToFileURL(path.join(__dirname, "..", "browser", "cap_wasm.js")).href
  );
  browserModule.initSync({
    module: fs.readFileSync(path.join(__dirname, "..", "browser", "cap_wasm_bg.wasm")),
  });
  return browserModule.solve_pow;
}

function assertCases(solvePow, cases) {
  for (const [salt, target, expectedNonce] of cases) {
    const actualNonce = solvePow(salt, target).toString();
    expect(actualNonce).toBe(String(expectedNonce));
  }
}

build();

const nodeSolvePow = loadSolvePow(path.join("..", "node", "cap_wasm.js"));

const regressionCases = [
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

const browserCases = [regressionCases[0], regressionCases[7], regressionCases[17]];

test("node wrapper regression", () => {
  assertCases(nodeSolvePow, regressionCases);
});

test("browser wrapper regression", async () => {
  const browserSolvePow = await loadBrowserSolvePow();
  assertCases(browserSolvePow, browserCases);
});
