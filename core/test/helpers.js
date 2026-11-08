import { sha256Hex } from "../src/crypto.js";
import { generateChallenge } from "../src/index.js";
import {
  boundValues,
  generateInstrumentation,
  serializeBound,
} from "../src/instrumentation.js";
import { prng } from "../src/prng.js";

export const TEST_SECRET =
  "meow-meow-meow-meow-dont-use-in-prod-meow-meow-meow-meow";

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
        throw new Error(
          `solver gave up at challenge ${i}/${c} (target=${target})`,
        );
      }
    }
  }
  return solutions;
}

export async function solveChallengeFromPublic(pub) {
  return await solveChallenge(
    pub.token,
    pub.challenge.c,
    pub.challenge.s,
    pub.challenge.d,
  );
}

export const emptyTrace = () => ({
  v: 1,
  res: 0.1,
  now: 5000,
  vis: 500,
  last: -1,
  us: -1,
  env: [1280, 800, 2, 1, 0, 80, 0, 0],
  n: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  m: [],
  k: [],
  a: null,
});

export function boundData(meta, data = {}) {
  return {
    v: 1,
    el: 0,
    p: null,
    vp: null,
    hp: {},
    ag: [],
    ia: meta.detectAutomatedInteractions ? [0, 0] : null,
    bh: meta.behavior ? emptyTrace() : null,
    ...data,
  };
}

export function boundPayload(meta, data = {}) {
  const d = serializeBound(boundData(meta, data));
  const vals = boundValues(meta.binding, d);
  return {
    i: meta.id,
    state: Object.fromEntries(meta.vars.map((v, i) => [v, vals[i]])),
    d,
  };
}

export function rawPayload(meta, d) {
  const vals = boundValues(meta.binding, d);
  return {
    i: meta.id,
    state: Object.fromEntries(meta.vars.map((v, i) => [v, vals[i]])),
    d,
  };
}

export async function issue(opts = {}) {
  let meta;
  const challenge = await generateChallenge(TEST_SECRET, {
    challengeCount: 1,
    challengeSize: 8,
    challengeDifficulty: 1,
    instrumentation: { obfuscationLevel: 1 },
    ...opts,
    instrumentationGenerator: async (o) => {
      meta = await generateInstrumentation(o);
      return meta;
    },
  });
  return { challenge, meta };
}
