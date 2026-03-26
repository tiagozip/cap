import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { solve_pow } from "../src/node/cap_wasm.js";

//                  salt,         target
const challenge = ["02679e6558", "eeffc"];

const [salt, target] = challenge;
const nonce = solve_pow(salt, target);
assert.equal(nonce.toString(), "1127415", `${salt}:${target}`);

const actualHash = createHash("sha256").update(`${salt}${nonce}`).digest("hex");
assert.equal(actualHash.slice(0, target.length), target);

console.log(`salt: ${salt}
target: ${target}
nonce: ${nonce}

sha256(${salt}${nonce})

should start with ${target}
is                ${actualHash.slice(0, target.length)} (${actualHash})

${actualHash.slice(0, target.length) === target ? "✅ success!" : "❌ invalid"}`);
