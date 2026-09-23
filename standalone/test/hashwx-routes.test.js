import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probeClient = new RedisClient(REDIS_URL);
  await probeClient.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn("[hashwx-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`hashwx standalone skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;

  const { capServer, resolveProtocol, invalidateKeyCache } = await import(
    "../src/cap.js"
  );
  const { db } = await import("../src/db.js");
  const { hashwxReady, hashwxSeed, hashwxHash, hashwxTarget } = await import(
    "capjs-core"
  );

  const app = new Elysia().use(capServer);
  const SITE_KEY = `test_hashwx_${Math.random().toString(16).slice(2)}`;
  const SECRET = "test-jwt-secret-32-bytes-padding-junk-1!";
  const DIFFICULTY = 60_000;
  const UA = "Mozilla/5.0 Chrome/120";

  const seedKey = async (config) => {
    await db.send("HSET", [
      `key:${SITE_KEY}`,
      "config",
      JSON.stringify(config),
      "jwtSecret",
      SECRET,
    ]);
    invalidateKeyCache(SITE_KEY);
  };

  beforeAll(async () => {
    await seedKey({
      protocol: "hashwx",
      hashwxDifficulty: DIFFICULTY,
      instrumentation: false,
    });
  });

  afterAll(async () => {
    await db.send("DEL", [`key:${SITE_KEY}`]);
    const keys = await db.send("KEYS", [`metrics:*:${SITE_KEY}`]);
    if (Array.isArray(keys) && keys.length > 0) await db.send("DEL", keys);
  });

  const mint = async () =>
    (
      await app.handle(
        new Request(`http://localhost/${SITE_KEY}/challenge`, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: "{}",
        }),
      )
    ).json();

  const redeem = async (body) =>
    (
      await app.handle(
        new Request(`http://localhost/${SITE_KEY}/redeem`, {
          method: "POST",
          headers: { "content-type": "application/json", "user-agent": UA },
          body: JSON.stringify(body),
        }),
      )
    ).json();

  const solveSpec = async (spec) => {
    const state = await hashwxReady();
    const target = hashwxTarget(spec.d);
    const challenge = Uint8Array.from(
      spec.c.match(/../g).map((h) => Number.parseInt(h, 16)),
    );
    for (let block = 0; block < 64; block++) {
      const seed = hashwxSeed(challenge, block);
      const base = BigInt(block) * BigInt(spec.n);
      for (let k = 0; k < spec.n; k++) {
        const nonce = base + BigInt(k);
        if (hashwxHash(state, seed, nonce) <= target) return nonce;
      }
    }
    throw new Error("solver gave up");
  };

  describe("resolveProtocol", () => {
    test("prefers the explicit protocol field", () => {
      expect(resolveProtocol({ protocol: "hashwx", rsw: true })).toBe("hashwx");
      expect(resolveProtocol({ protocol: "sha256-pow", rsw: true })).toBe(
        "sha256-pow",
      );
    });

    test("falls back to the legacy rsw boolean", () => {
      expect(resolveProtocol({ rsw: true })).toBe("rsw");
      expect(resolveProtocol({ rsw: false })).toBe("sha256-pow");
      expect(resolveProtocol({})).toBe("sha256-pow");
    });

    test("ignores an unknown protocol", () => {
      expect(resolveProtocol({ protocol: "wat", rsw: true })).toBe("rsw");
    });
  });

  const SUB_CHALLENGES = 4;

  const solveAll = async (body) => {
    const nonces = [];
    for (const ch of body.challenges) {
      if (ch.protocol === "hashwx") nonces.push(await solveSpec(ch.payload));
    }
    return nonces;
  };

  const asSolutions = (nonces) =>
    nonces.map((nonce) => ({ protocol: "hashwx", nonce: String(nonce) }));

  describe("standalone hashwx challenges", () => {
    test("mints four sub-challenges that split the configured difficulty", async () => {
      const body = await mint();
      expect(body.format).toBe(2);
      expect(body.challenges).toHaveLength(SUB_CHALLENGES);
      const seen = new Set();
      for (const ch of body.challenges) {
        expect(ch.protocol).toBe("hashwx");
        expect(ch.payload.d).toBe(DIFFICULTY / SUB_CHALLENGES);
        expect(ch.payload.n).toBe(65536);
        expect(ch.payload.c).toMatch(/^[0-9a-f]{64}$/);
        seen.add(ch.payload.c);
      }
      expect(seen.size).toBe(SUB_CHALLENGES);
    });

    test("accepts valid solutions and issues a token", async () => {
      const body = await mint();
      const res = await redeem({
        token: body.token,
        format: 2,
        solutions: asSolutions(await solveAll(body)),
      });
      expect(res.success).toBe(true);
      expect(typeof res.token).toBe("string");
    });

    test("rejects a set with one off-by-one nonce", async () => {
      const body = await mint();
      const nonces = await solveAll(body);
      nonces[2] = nonces[2] + 1n;
      const res = await redeem({
        token: body.token,
        format: 2,
        solutions: asSolutions(nonces),
      });
      expect(res.success).toBeFalsy();
    });

    test("rejects a set with a missing solution", async () => {
      const body = await mint();
      const nonces = await solveAll(body);
      const res = await redeem({
        token: body.token,
        format: 2,
        solutions: asSolutions(nonces.slice(0, SUB_CHALLENGES - 1)),
      });
      expect(res.success).toBeFalsy();
    });

    test("rejects a set with the solutions in the wrong order", async () => {
      const body = await mint();
      const nonces = await solveAll(body);
      const res = await redeem({
        token: body.token,
        format: 2,
        solutions: asSolutions([...nonces].reverse()),
      });
      expect(res.success).toBeFalsy();
    });

    test("rejects a malformed nonce alongside valid ones", async () => {
      for (const bad of [
        "-1",
        "1.5",
        "abc",
        "",
        null,
        "99999999999999999999999",
      ]) {
        const body = await mint();
        const solutions = asSolutions(await solveAll(body));
        solutions[0] = { protocol: "hashwx", nonce: bad };
        const res = await redeem({ token: body.token, format: 2, solutions });
        expect(res.success).toBeFalsy();
      }
    });

    test("rejects a replayed token", async () => {
      const body = await mint();
      const solutions = asSolutions(await solveAll(body));
      const first = await redeem({ token: body.token, format: 2, solutions });
      expect(first.success).toBe(true);
      const second = await redeem({ token: body.token, format: 2, solutions });
      expect(second.success).toBeFalsy();
    });

    test("ignores a client-lowered difficulty", async () => {
      const body = await mint();
      const easy = [];
      for (const ch of body.challenges) {
        easy.push(await solveSpec({ ...ch.payload, d: 1 }));
      }
      const res = await redeem({
        token: body.token,
        format: 2,
        solutions: asSolutions(easy),
      });
      expect(res.success).toBeFalsy();
    });

    test("pairs hashwx with instrumentation when enabled", async () => {
      await seedKey({
        protocol: "hashwx",
        hashwxDifficulty: DIFFICULTY,
        instrumentation: true,
      });
      const body = await mint();
      expect(body.challenges.map((c) => c.protocol)).toEqual([
        ...Array(SUB_CHALLENGES).fill("hashwx"),
        "instrumentation",
      ]);
      await seedKey({
        protocol: "hashwx",
        hashwxDifficulty: DIFFICULTY,
        instrumentation: false,
      });
    });

    test("clamps an out-of-range configured difficulty", async () => {
      await seedKey({ protocol: "hashwx", hashwxDifficulty: 1 });
      expect((await mint()).challenges[0].payload.d).toBe(
        50_000 / SUB_CHALLENGES,
      );
      await seedKey({ protocol: "hashwx", hashwxDifficulty: 999_999_999 });
      expect((await mint()).challenges[0].payload.d).toBe(
        5_000_000 / SUB_CHALLENGES,
      );
      await seedKey({
        protocol: "hashwx",
        hashwxDifficulty: DIFFICULTY,
        instrumentation: false,
      });
    });
  });
}
