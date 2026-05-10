import { sha256Hex } from "../src/crypto.js";
import { prng } from "../src/prng.js";

export const TEST_SECRET = "meow-meow-meow-meow-dont-use-in-prod-meow-meow-meow-meow";

export async function solveChallenge(token, c, s, d) {
  const solutions = [];
  for (let i = 1; i <= c; i++) {
    const salt = prng(`${token}${i}`, s);
    const target = prng(`${token}${i}d`, d);
    let n = 0;
    while (true) {
      const hash = await sha256Hex(salt + n);
      if (hash.startsWith(target)) {
        solutions.push(n);
        break;
      }
      n++;
      if (n > 5_000_000) {
        throw new Error(`solver gave up at challenge ${i}/${c} (target=${target})`);
      }
    }
  }
  return solutions;
}

export async function solveChallengeFromPublic(pub) {
  return await solveChallenge(pub.token, pub.challenge.c, pub.challenge.s, pub.challenge.d);
}
