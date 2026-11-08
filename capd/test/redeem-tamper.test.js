import { afterAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  redisAvailable = true;
} catch {}

if (!redisAvailable) {
  test.skip(`redeem tamper tests skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  const { capServer, invalidateKeyCache } = await import("../src/cap.js");
  const { siteverifyServer } = await import("../src/siteverify.js");
  const { db } = await import("../src/db.js");
  const { hashSecret } = await import("../src/secret-hash.js");
  const {
    boundValues,
    generateChallenge,
    generateInstrumentation,
    serializeBound,
  } = await import("capjs-core");

  const app = new Elysia().use(capServer).use(siteverifyServer);
  const tag = Math.random().toString(16).slice(2, 10);
  const SITE_A = `ta${tag}`;
  const SITE_B = `${SITE_A}b`;
  const JWT_SECRET = "redeem-tamper-jwt-secret-32-bytes!!!!";
  const SECRET_A = "redeem-tamper-secret-a";
  const SECRET_B = "redeem-tamper-secret-b";

  for (const [key, secret] of [
    [SITE_A, SECRET_A],
    [SITE_B, SECRET_B],
  ]) {
    await db.send("HSET", [
      `key:${key}`,
      "config",
      JSON.stringify({
        protocol: "sha256-pow",
        challengeCount: 1,
        saltSize: 8,
        difficulty: 1,
        instrumentation: true,
        behavior: "off",
      }),
      "jwtSecret",
      JWT_SECRET,
      "secretHash",
      hashSecret(secret),
    ]);
    invalidateKeyCache(key);
  }

  afterAll(async () => {
    await db.send("DEL", [`key:${SITE_A}`, `key:${SITE_B}`]);
  });

  const post = async (path, body, raw) => {
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw ?? JSON.stringify(body),
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  async function redeem(siteKey, extra = {}) {
    let meta;
    const ch = await generateChallenge(JWT_SECRET, {
      format: 2,
      protocols: ["instrumentation"],
      scope: siteKey,
      instrumentation: { obfuscationLevel: 1 },
      instrumentationGenerator: async (o) => {
        meta = await generateInstrumentation(o);
        return meta;
      },
    });
    const d = serializeBound({
      v: 1,
      el: 0,
      p: null,
      vp: null,
      hp: {},
      ag: [],
      ia: null,
      bh: null,
    });
    const vals = boundValues(meta.binding, d);
    const instr = {
      i: meta.id,
      state: Object.fromEntries(meta.vars.map((v, i) => [v, vals[i]])),
      d,
    };
    return post(`/${siteKey}/redeem`, {
      token: ch.token,
      solutions: [{ instr }],
      ...extra,
    });
  }

  describe("redeem and siteverify tampering", () => {
    test("a redeem token verifies exactly once", async () => {
      const r = await redeem(SITE_A);
      expect(r.status).toBe(200);
      const first = await post("/siteverify", {
        secret: SECRET_A,
        response: r.body.token,
      });
      expect(first.body.success).toBe(true);
      const second = await post("/siteverify", {
        secret: SECRET_A,
        response: r.body.token,
      });
      expect(second.body.success).toBe(false);
    });

    test("a token cannot be verified with another key's secret or path", async () => {
      const r = await redeem(SITE_A);
      const wrongSecret = await post("/siteverify", {
        secret: SECRET_B,
        response: r.body.token,
      });
      expect(wrongSecret.body.success).toBe(false);
      const wrongPath = await post(`/${SITE_B}/siteverify`, {
        secret: SECRET_A,
        response: r.body.token,
      });
      expect(wrongPath.body.success).toBe(false);
      const prefixPath = await post(`/${SITE_A}/siteverify`, {
        secret: SECRET_B,
        response: `${SITE_B}:${r.body.token.split(":").slice(1).join(":")}`,
      });
      expect(prefixPath.body.success).toBe(false);
      const ok = await post(`/${SITE_A}/siteverify`, {
        secret: SECRET_A,
        response: r.body.token,
      });
      expect(ok.body.success).toBe(true);
    });

    test("a token issued for one site key does not verify under a key it prefixes", async () => {
      const r = await redeem(SITE_B);
      const res = await post(`/${SITE_A}/siteverify`, {
        secret: SECRET_B,
        response: r.body.token,
      });
      expect(res.body.success).toBe(false);
    });

    test("a challenge for one site key cannot be redeemed on another", async () => {
      let meta;
      const ch = await generateChallenge(JWT_SECRET, {
        challengeCount: 1,
        challengeSize: 8,
        challengeDifficulty: 1,
        scope: SITE_A,
        instrumentationGenerator: async (o) => {
          meta = await generateInstrumentation(o);
          return meta;
        },
      });
      expect(meta).toBeUndefined();
      const r = await post(`/${SITE_B}/redeem`, {
        token: ch.token,
        solutions: [0],
      });
      expect(r.status).toBe(403);
    });

    test("expired and malformed records fail", async () => {
      const expired = `${SITE_A}:old:${tag}`;
      await db.set(`token:${expired}`, JSON.stringify({ e: Date.now() - 1 }));
      expect(
        (await post("/siteverify", { secret: SECRET_A, response: expired }))
          .body.success,
      ).toBe(false);
      const noExpiry = `${SITE_A}:none:${tag}`;
      await db.set(`token:${noExpiry}`, JSON.stringify({ f: [] }));
      expect(
        (await post("/siteverify", { secret: SECRET_A, response: noExpiry }))
          .body.success,
      ).toBe(false);
      const legacyNaN = `${SITE_A}:nan:${tag}`;
      await db.set(`token:${legacyNaN}`, "soon");
      expect(
        (await post("/siteverify", { secret: SECRET_A, response: legacyNaN }))
          .body.success,
      ).toBe(false);
    });

    test("non-string or malformed responses are rejected", async () => {
      for (const response of [
        ["a", "b"],
        { toString: "x" },
        123,
        `${SITE_A}::x`,
        `${SITE_A}:x`,
        `${SITE_A}:x:y:z`,
      ]) {
        const r = await post("/siteverify", { secret: SECRET_A, response });
        expect(r.body.success).toBe(false);
      }
      const r = await post("/siteverify", {
        secret: [SECRET_A],
        response: `${SITE_A}:x:y`,
      });
      expect(r.body.success).toBe(false);
    });

    test("a redeem body over 256 KB is refused before parsing", async () => {
      const r = await post(
        `/${SITE_A}/redeem`,
        null,
        JSON.stringify({ token: "x", pad: "y".repeat(300 * 1024) }),
      );
      expect(r.status).toBe(413);
    });

    test("fields outside the bound result do not reach siteverify", async () => {
      const r = await redeem(SITE_A, {
        behavior: { v: 1, a: { k: 2 } },
        interactions: { version: 1, syntheticClicks: 9 },
        riskFlags: ["x"],
      });
      expect(r.status).toBe(200);
      const v = await post("/siteverify", {
        secret: SECRET_A,
        response: r.body.token,
      });
      expect(v.body.success).toBe(true);
      expect(v.body.riskFlags ?? []).toEqual([]);
      expect(v.body.behavior).toBeUndefined();
    });
  });
}
