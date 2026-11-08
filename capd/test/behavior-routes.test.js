import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
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
  test.skip(`behavior routes skipped (no redis at ${REDIS_URL})`, () => {});
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
  const SITE_KEY = `bh_site_${Math.random().toString(16).slice(2)}`;
  const JWT_SECRET = "behavior-routes-jwt-secret-32-bytes!!";
  const SITE_SECRET = "behavior-routes-site-secret";

  const sha = (s) => createHash("sha256").update(s).digest("hex");

  async function setMode(next, extra = {}) {
    mode = next;
    blockMode = next === "block";
    await db.send("HSET", [
      `key:${SITE_KEY}`,
      "config",
      JSON.stringify({
        protocol: "sha256-pow",
        challengeCount: 2,
        saltSize: 8,
        difficulty: 1,
        instrumentation: false,
        behavior: next,
        ...extra,
      }),
      "jwtSecret",
      JWT_SECRET,
      "secretHash",
      hashSecret(SITE_SECRET),
    ]);
    invalidateKeyCache(SITE_KEY);
  }

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

  let mode = "off";
  let blockMode = false;

  async function issue() {
    let meta;
    const policy =
      mode === "off"
        ? false
        : { block: blockMode, requireInteraction: false, blockAgents: false };
    const ch = await generateChallenge(JWT_SECRET, {
      challengeCount: 2,
      challengeSize: 8,
      challengeDifficulty: 1,
      scope: SITE_KEY,
      instrumentation: false,
      behavior: policy,
      instrumentationGenerator: async (o) => {
        meta = await generateInstrumentation(o);
        return meta;
      },
    });
    return { ch, meta };
  }

  function bind(meta, data) {
    const d = serializeBound({
      v: 1,
      el: 0,
      p: null,
      vp: null,
      hp: {},
      ag: [],
      ia: null,
      bh: null,
      ...data,
    });
    const vals = boundValues(meta.binding, d);
    return {
      i: meta.id,
      state: Object.fromEntries(meta.vars.map((v, i) => [v, vals[i]])),
      d,
    };
  }

  async function round(behavior, headers = {}, { ag = [], body = {} } = {}) {
    const { ch, meta } = await issue();
    const solutions = [];
    for (let i = 1; i <= ch.challenge.c; i++) {
      const salt = prng(`${ch.token}${i}`, ch.challenge.s);
      const target = prng(`${ch.token}${i}d`, ch.challenge.d);
      let n = 0;
      while (!sha(salt + n).startsWith(target)) n++;
      solutions.push(n);
    }
    const instr = meta && bind(meta, { bh: behavior ?? null, ag });
    const res = await app.handle(
      new Request(`http://localhost/${SITE_KEY}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          token: ch.token,
          solutions,
          ...(instr && { instr }),
          ...body,
        }),
      }),
    );
    return { ch, status: res.status, body: await res.json() };
  }

  async function siteverify(response) {
    const res = await app.handle(
      new Request("http://localhost/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SITE_SECRET, response }),
      }),
    );
    return res.json();
  }

  const trace = (over = {}) => ({
    v: 1,
    res: 0.1,
    now: 5000,
    vis: 300,
    last: 3400,
    env: [1440, 820, 2, 1, 0, 87, 120, 60],
    n: [0, 0, 0, 0, 12, 0, 1, 0, 0, 0],
    us: -1,
    m: Array.from({ length: 12 }, (_, i) => [
      3000 + i * 16.7 + (i % 3) * 1.3,
      100 + i * 30 + (i % 2) * 4.1 + i * i * 0.7,
      600 - i * 22 + (i % 3) * 2.7,
      1 + (i % 2),
      0,
    ]),
    k: [],
    a: {
      k: 0,
      tr: 1,
      hid: 0,
      pt: 0,
      t: 3400,
      u: 3488,
      x: 527.3,
      y: 365.2,
      cx: -40.1,
      cy: 3.3,
      w: 258,
      h: 56,
      sox: 120,
      soy: 147,
      cw: 1,
      ch: 1,
      pr: 0.5,
    },
    ...over,
  });

  beforeAll(() => setMode("report"));
  afterAll(async () => {
    await db.send("DEL", [`key:${SITE_KEY}`]);
    const keys = await db.send("KEYS", [`bhtrace:${SITE_KEY}:*`]);
    if (Array.isArray(keys) && keys.length) await db.send("DEL", keys);
  });

  describe("behavior in capd", () => {
    test("the challenge route ships a script whenever behavior is on", async () => {
      await setMode("report");
      const issued = await app
        .handle(
          new Request(`http://localhost/${SITE_KEY}/challenge`, {
            method: "POST",
          }),
        )
        .then((r) => r.json());
      expect(issued.behavior).toBe(true);
      expect(typeof issued.instrumentation).toBe("string");
      await setMode("off");
      const plain = await app
        .handle(
          new Request(`http://localhost/${SITE_KEY}/challenge`, {
            method: "POST",
          }),
        )
        .then((r) => r.json());
      expect(plain.behavior).toBeUndefined();
      expect(plain.instrumentation).toBeUndefined();
    });

    test("off: challenge does not ask for a trace", async () => {
      await setMode("off");
      const { ch, body } = await round(undefined);
      expect(ch.behavior).toBeUndefined();
      expect(body.success).toBe(true);
      const v = await siteverify(body.token);
      expect(v).toEqual({ success: true });
    });

    test("report: siteverify returns score, verdict and flags", async () => {
      await setMode("report");
      const bot = trace({ a: { k: 2, tr: 0, hid: 0, t: 3400, u: -1 } });
      const { ch, body } = await round(bot);
      expect(ch.behavior).toBe(true);
      expect(body.success).toBe(true);
      const v = await siteverify(body.token);
      expect(v.success).toBe(true);
      expect(v.behavior.verdict).toBe("automated");
      expect(v.riskFlags).toContain("bh_untrusted_activation");
    });

    test("block: rejects automated, accepts human-shaped", async () => {
      await setMode("block");
      const bad = await round(
        trace({ a: { k: 2, tr: 0, hid: 0, t: 3400, u: -1 } }),
      );
      expect(bad.status).toBe(403);
      expect(bad.body.reason).toBe("behavior_automated");

      const good = await round(trace());
      expect(good.status).toBe(200);
      const v = await siteverify(good.body.token);
      expect(v.behavior.verdict).toBe("ok");
      expect(v.riskFlags).toEqual([]);
    });

    test("block: a replayed trace is rejected the second time", async () => {
      await setMode("block");
      const t = trace({
        m: trace().m.map((p) => [
          p[0] + 37,
          p[1] + 9.3,
          p[2] - 5.1,
          p[3],
          p[4],
        ]),
      });
      const first = await round(t);
      expect(first.status).toBe(200);
      const again = await round(t);
      expect(again.status).toBe(403);
      expect(again.body.reason).toBe("behavior_automated");
    });

    test("a trace sent next to the result is ignored", async () => {
      await setMode("block");
      const bot = trace({ a: { k: 2, tr: 0, hid: 0, t: 3400, u: -1 } });
      const human = trace({
        m: trace().m.map((p) => [
          p[0] + 91,
          p[1] + 2.9,
          p[2] - 3.3,
          p[3],
          p[4],
        ]),
      });
      const r = await round(human, {}, { body: { behavior: bot } });
      expect(r.status).toBe(200);
      const forged = await round(null, {}, { body: { behavior: human } });
      expect(forged.status).toBe(403);
      expect(forged.body.reason).toBe("behavior_missing");
    });

    test("report: a missing trace still fails", async () => {
      await setMode("report");
      const r = await round(undefined);
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe("behavior_missing");
    });

    test("block: missing trace is rejected", async () => {
      await setMode("block");
      const r = await round(undefined);
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe("behavior_missing");
    });

    test("agents: report mode names the agent in siteverify", async () => {
      await setMode("report");
      const { body } = await round(
        trace({
          m: trace().m.map((p) => [
            p[0] + 400,
            p[1] - 13.7,
            p[2] + 21.9,
            p[3],
            p[4],
          ]),
        }),
        {},
        { ag: ["cic_active"] },
      );
      expect(body.success).toBe(true);
      const v = await siteverify(body.token);
      expect(v.behavior.verdict).toBe("agent");
      expect(v.behavior.agent).toEqual({
        name: "claude-in-chrome",
        confidence: "high",
        verified: false,
      });
      expect(v.riskFlags).toContain("agent:claude-in-chrome");
    });

    test("agents: a Claude-Agent user agent is blocked when identified agents are", async () => {
      await setMode("report", { blockAgents: "identified" });
      const r = await round(
        trace({
          m: trace().m.map((p) => [
            p[0] + 800,
            p[1] + 31.3,
            p[2] - 7.9,
            p[3],
            p[4],
          ]),
        }),
        {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-Agent/1.0) Chrome/154.0.0.0 Safari/537.36",
        },
      );
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe("behavior_agent");
    });
  });
}
