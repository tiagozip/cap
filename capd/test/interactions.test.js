import { afterAll, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { RedisClient } from "bun";
import {
  boundValues,
  generateChallenge,
  generateInstrumentation,
  serializeBound,
} from "capjs-core";
import { Elysia } from "elysia";

let redisAvailable = false;
try {
  const probe = new RedisClient(
    process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379",
  );
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

if (!redisAvailable) {
  test.skip("interaction routes require Redis", () => {});
} else {
  process.env.ADMIN_KEY ||= "local-interaction-test-admin";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";
  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { capServer } = await import("../src/cap.js");
  const { siteverifyServer } = await import("../src/siteverify.js");
  const { db } = await import("../src/db.js");
  const app = new Elysia()
    .use(auth)
    .use(server)
    .use(capServer)
    .use(siteverifyServer);
  const created = [];
  const call = async (path, body, authorization, method = "POST") =>
    (
      await app.handle(
        new Request(`http://localhost${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            "user-agent": "Mozilla/5.0 Chrome/120",
            ...(authorization && { authorization }),
          },
          ...(body && { body: JSON.stringify(body) }),
        }),
      )
    ).json();
  const issueBound = async (secret, siteKey, instrumentation) => {
    let meta;
    const challenge = await generateChallenge(secret, {
      format: 2,
      protocols: ["instrumentation"],
      scope: siteKey,
      instrumentation,
      instrumentationGenerator: async (o) => {
        meta = await generateInstrumentation(o);
        return meta;
      },
    });
    const solve = (ia) => {
      const d = serializeBound({
        v: 1,
        el: 0,
        p: null,
        vp: null,
        hp: {},
        ag: [],
        ia,
        bh: null,
      });
      const vals = boundValues(meta.binding, d);
      return {
        i: meta.id,
        state: Object.fromEntries(meta.vars.map((v, i) => [v, vals[i]])),
        d,
      };
    };
    return { challenge, meta, solve };
  };
  const login = await call("/auth/login", { admin_key: process.env.ADMIN_KEY });
  const authorization = `Bearer ${btoa(JSON.stringify({ token: login.session_token, hash: login.hashed_token }))}`;
  afterAll(async () => {
    for (const key of created)
      await call(
        `/server/keys/${key.siteKey}`,
        undefined,
        authorization,
        "DELETE",
      );
    await db.del(`session:${login.hashed_token}`);
    await db.srem("sessions", login.hashed_token);
  });

  test("HashWX defaults, interaction opt-in persistence and generated observation", async () => {
    const key = await call(
      "/server/keys",
      { name: "interaction-default-test" },
      authorization,
    );
    created.push(key);
    let config = JSON.parse(await db.hget(`key:${key.siteKey}`, "config"));
    expect(config.protocol).toBe("hashwx");
    expect(config.detectAutomatedInteractions).toBe(false);
    await call(
      `/server/keys/${key.siteKey}/config`,
      { instrumentation: true, detectAutomatedInteractions: true },
      authorization,
      "PUT",
    );
    config = JSON.parse(await db.hget(`key:${key.siteKey}`, "config"));
    expect(config.detectAutomatedInteractions).toBe(true);
    const challenge = await call(`/${key.siteKey}/challenge`, {});
    const blob = challenge.challenges.find(
      (part) => part.protocol === "instrumentation",
    ).payload.blob;
    expect(inflateRawSync(Buffer.from(blob, "base64")).toString()).toContain(
      "cap:finalize",
    );
    await call(
      `/server/keys/${key.siteKey}/config`,
      { detectAutomatedInteractions: false },
      authorization,
      "PUT",
    );
    config = JSON.parse(await db.hget(`key:${key.siteKey}`, "config"));
    expect(config.detectAutomatedInteractions).toBe(false);
  });

  test("siteverify authenticates reports, consumes tokens and accepts legacy storage", async () => {
    const key = await call(
      "/server/keys",
      {
        name: "interaction-report-test",
        instrumentation: true,
        detectAutomatedInteractions: true,
      },
      authorization,
    );
    created.push(key);
    const jwtSecret = await db.hget(`key:${key.siteKey}`, "jwtSecret");
    const { challenge, solve } = await issueBound(jwtSecret, key.siteKey, {
      detectAutomatedInteractions: true,
    });
    const redeemed = await call(`/${key.siteKey}/redeem`, {
      token: challenge.token,
      solutions: [{ instr: solve([3, 0]) }],
    });
    expect(redeemed.success).toBe(true);
    expect(
      (
        await call("/siteverify", {
          secret: "wrong-secret",
          response: redeemed.token,
        })
      ).success,
    ).toBe(false);
    expect(
      await call("/siteverify", {
        secret: key.secretKey,
        response: redeemed.token,
      }),
    ).toEqual({ success: true, riskFlags: ["interaction_synthetic_clicks"] });
    expect(
      (
        await call("/siteverify", {
          secret: key.secretKey,
          response: redeemed.token,
        })
      ).success,
    ).toBe(false);
    const legacyToken = `${key.siteKey}:legacy:test`;
    await db.set(`token:${legacyToken}`, String(Date.now() + 60_000));
    expect(
      await call("/siteverify", {
        secret: key.secretKey,
        response: legacyToken,
      }),
    ).toEqual({ success: true });
  });
  test("counts sent outside the bound result are rejected", async () => {
    const key = await call(
      "/server/keys",
      { name: "interaction-unbound-test", instrumentation: true },
      authorization,
    );
    created.push(key);
    const secret = await db.hget(`key:${key.siteKey}`, "jwtSecret");
    const { challenge, solve } = await issueBound(secret, key.siteKey, {
      detectAutomatedInteractions: true,
    });
    const result = await call(`/${key.siteKey}/redeem`, {
      token: challenge.token,
      solutions: [
        {
          instr: {
            ...solve([0, 0]),
            interactions: { version: 1, syntheticClicks: 9 },
          },
        },
      ],
    });
    expect(result.success).not.toBe(true);
    expect(result.reason).toBe("failed_challenge");
  });

  test("interaction blocking returns a rejection and permits no-input solves", async () => {
    const key = await call(
      "/server/keys",
      {
        name: "interaction-block-test",
        instrumentation: true,
        blockAutomatedInteractions: true,
      },
      authorization,
    );
    created.push(key);
    const config = JSON.parse(await db.hget(`key:${key.siteKey}`, "config"));
    expect(config.blockAutomatedInteractions).toBe(true);
    const issued = await call(`/${key.siteKey}/challenge`, {});
    const blob = issued.challenges.find(
      (part) => part.protocol === "instrumentation",
    ).payload.blob;
    expect(inflateRawSync(Buffer.from(blob, "base64")).toString()).toContain(
      "cap:finalize",
    );
    const secret = await db.hget(`key:${key.siteKey}`, "jwtSecret");
    for (const count of [3, 0]) {
      const { challenge, solve } = await issueBound(secret, key.siteKey, {
        blockAutomatedInteractions: true,
        detectAutomatedInteractions: true,
      });
      const result = await call(`/${key.siteKey}/redeem`, {
        token: challenge.token,
        solutions: [{ instr: solve([count, 0]) }],
      });
      if (count) expect(result.reason).toBe("automated_interaction_detected");
      else expect(result.success).toBe(true);
    }
  });
}
