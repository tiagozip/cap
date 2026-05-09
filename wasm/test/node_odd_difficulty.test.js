import { createHash } from "node:crypto";
import { test, expect } from "bun:test";
import { solve_pow } from "../src/node/cap_wasm.js";

//                  salt,         target
const challenge = ["02679e6558", "eeffc"];

test("odd difficulty challenge", () => {
  const [salt, target] = challenge;
  const nonce = solve_pow(salt, target);
  expect(nonce.toString()).toBe("1127415");

  const actualHash = createHash("sha256").update(`${salt}${nonce}`).digest("hex");
  expect(actualHash.slice(0, target.length)).toBe(target);

  console.log(`salt: ${salt}
target: ${target}
nonce: ${nonce}

sha256(${salt}${nonce})

should start with ${target}
is                ${actualHash.slice(0, target.length)} (${actualHash})

${actualHash.slice(0, target.length) === target ? "✅ success!" : "❌ invalid"}`);
});
