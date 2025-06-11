import { createHash } from "crypto";
import { solve_pow } from "../src/node/cap_wasm.js";

//                  salt,         target
const challenge = ["02679e6558", "eeffc"];

const [salt, target] = challenge;
const nonce = solve_pow(salt, target);

const actualHash = createHash("sha256").update(`${salt}${nonce}`).digest("hex");

console.log(`salt: ${salt}
target: ${target}
nonce: ${nonce}

sha256(${salt}${nonce})

should start with ${target}
is                ${actualHash.slice(0, target.length)} (${actualHash})

${
  actualHash.slice(0, target.length) === target ? "✅ success!" : "❌ invalid"
}`);
