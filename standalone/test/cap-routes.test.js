import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
let probeClient;
try {
  probeClient = new RedisClient(REDIS_URL);
  await probeClient.send("PING", []);
  redisAvailable = true;
} catch (e) {
  console.warn(
    "[standalone-test] redis not available, skipping integration tests:",
    e.message,
  );
}

if (!redisAvailable) {
  test.skip(`standalone integration skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;

  // Lazy-load standalone modules after redis is confirmed
  const { capServer } = await import("../src/cap.js");
  const { db } = await import("../src/db.js");
  const { generateChallenge: cgChallenge } = await import("capjs-core");
  const { createHash } = await import("node:crypto");

  function fnv1a(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  }
  function prng(seed, length) {
    let state = fnv1a(seed);
    let result = "";
    while (result.length < length) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      result += state.toString(16).padStart(8, "0");
    }
    return result.substring(0, length);
  }
  function sha256Hex(s) {
    return createHash("sha256").update(s).digest("hex");
  }

  const app = new Elysia().use(capServer);
  const SITE_KEY = `test_site_key_${Math.random().toString(16).slice(2)}`;
  const SECRET = "test-jwt-secret-32-bytes-padding-junk-1!";

  beforeAll(async () => {
    const config = {
      challengeCount: 3,
      saltSize: 16,
      difficulty: 2,
      instrumentation: false,
    };
    await db.send("HSET", [
      `key:${SITE_KEY}`,
      "config",
      JSON.stringify(config),
      "jwtSecret",
      SECRET,
    ]);
  });

  afterAll(async () => {
    // Cleanup: remove the site key and any blocklist/token entries
    await db.send("DEL", [`key:${SITE_KEY}`]);
    await db.send("DEL", ["settings:rsw_keypair"]);
    const keys = await db.send("KEYS", [`metrics:*:${SITE_KEY}`]);
    if (Array.isArray(keys) && keys.length > 0) {
      await db.send("DEL", keys);
    }
  });

  function solve(token, c, s, d) {
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
        if (n > 1_000_000) throw new Error("solver gave up");
      }
    }
    return solutions;
  }

  describe("standalone /:siteKey/challenge", () => {
    test("issues a JWT challenge", async () => {
      const res = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/challenge`, {
          method: "POST",
        }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.challenge.c).toBe(3);
      expect(body.challenge.s).toBe(16);
      expect(body.challenge.d).toBe(2);
      expect(typeof body.token).toBe("string");
      expect(body.token.split(".")).toHaveLength(3);
      expect(body.expires).toBeGreaterThan(Date.now());
    });

    test("returns 404 for unknown site key", async () => {
      const res = await app.handle(
        new Request("http://localhost/nonexistent_key/challenge", {
          method: "POST",
        }),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("standalone /:siteKey/redeem", () => {
    test("rejects invalid solutions", async () => {
      const res = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/challenge`, {
          method: "POST",
        }),
      );
      const ch = await res.json();
      const bogus = [0, 0, 0];
      const r = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ch.token, solutions: bogus }),
        }),
      );
      expect(r.status).toBe(403);
    });

    test("accepts valid solutions and returns a redeem token", async () => {
      const ch = await app
        .handle(
          new Request(`http://localhost/${SITE_KEY}/challenge`, {
            method: "POST",
          }),
        )
        .then((r) => r.json());
      const solutions = solve(
        ch.token,
        ch.challenge.c,
        ch.challenge.s,
        ch.challenge.d,
      );
      const r = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ch.token, solutions }),
        }),
      );
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.success).toBe(true);
      expect(body.token.startsWith(`${SITE_KEY}:`)).toBe(true);
    }, 30_000);

    test("rejects replay (already_redeemed)", async () => {
      const ch = await app
        .handle(
          new Request(`http://localhost/${SITE_KEY}/challenge`, {
            method: "POST",
          }),
        )
        .then((r) => r.json());
      const solutions = solve(
        ch.token,
        ch.challenge.c,
        ch.challenge.s,
        ch.challenge.d,
      );
      const a = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ch.token, solutions }),
        }),
      );
      expect(a.status).toBe(200);
      const b = await app.handle(
        new Request(`http://localhost/${SITE_KEY}/redeem`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: ch.token, solutions }),
        }),
      );
      expect(b.status).toBe(403);
    }, 30_000);

    test("RSW: issues format-2 challenge and accepts solution", async () => {
      const { ensureRswKeypair } = await import("../src/rsw-store.js");
      await ensureRswKeypair();
      const rswKey = `rsw_site_key_${Math.random().toString(16).slice(2)}`;
      const rswT = 10_000;
      await db.send("HSET", [
        `key:${rswKey}`,
        "config",
        JSON.stringify({ rsw: true, rswT, instrumentation: false }),
        "jwtSecret",
        SECRET,
      ]);
      try {
        const ch = await app
          .handle(
            new Request(`http://localhost/${rswKey}/challenge`, {
              method: "POST",
            }),
          )
          .then((r) => r.json());

        expect(ch.format).toBe(2);
        expect(Array.isArray(ch.challenges)).toBe(true);
        expect(ch.challenges[0].protocol).toBe("rsw");

        const { N, x, t } = ch.challenges[0].payload;
        expect(t).toBe(rswT);

        const Nb = BigInt(`0x${N}`);
        let y = BigInt(`0x${x}`);
        for (let i = 0; i < t; i++) y = (y * y) % Nb;
        const yHex = y.toString(16);

        const redeem = await app.handle(
          new Request(`http://localhost/${rswKey}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: ch.token,
              solutions: [{ y: yHex }],
            }),
          }),
        );
        expect(redeem.status).toBe(200);
        const body = await redeem.json();
        expect(body.success).toBe(true);
      } finally {
        await db.send("DEL", [`key:${rswKey}`]);
      }
    }, 30_000);

    test("rejects scope mismatch (token from another site key)", async () => {
      const otherKey = `other_site_key_${Math.random().toString(16).slice(2)}`;
      await db.send("HSET", [
        `key:${otherKey}`,
        "config",
        JSON.stringify({}),
        "jwtSecret",
        SECRET,
      ]);
      try {
        const challengeFromOther = await cgChallenge(SECRET, {
          challengeCount: 1,
          challengeSize: 4,
          challengeDifficulty: 1,
          scope: otherKey,
        });
        const r = await app.handle(
          new Request(`http://localhost/${SITE_KEY}/redeem`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: challengeFromOther.token,
              solutions: [0],
            }),
          }),
        );
        expect(r.status).toBe(403);
      } finally {
        await db.send("DEL", [`key:${otherKey}`]);
      }
    });
  });
}
