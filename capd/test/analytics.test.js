import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash, createHmac } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RedisClient } from "bun";
import { Elysia } from "elysia";

const REDIS_URL =
  process.env.REDIS_URL || process.env.VALKEY_URL || "redis://127.0.0.1:6379";

let redisAvailable = false;
try {
  const probe = new RedisClient(REDIS_URL);
  await probe.send("PING", []);
  probe.close();
  redisAvailable = true;
} catch {}

const backends = [["duckdb"]];
if (process.env.TEST_CLICKHOUSE_URL) backends.push(["clickhouse"]);

if (!redisAvailable) {
  test.skip(`analytics integration skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.DUCKDB_PATH = join(
    tmpdir(),
    `cap-events-${process.pid}-${Date.now()}.duckdb`,
  );

  const { capServer, invalidateKeyCache } = await import("../src/cap.js");
  const { siteverifyServer } = await import("../src/siteverify.js");
  const { db } = await import("../src/db.js");
  const events = await import("../src/events/index.js");
  const analytics = await import("../src/events/analytics.js");
  const { saveRules } = await import("../src/policy/rules.js");
  const lists = await import("../src/policy/lists.js");
  const webhooks = await import("../src/policy/webhooks.js");
  const { hashSecret } = await import("../src/secret-hash.js");

  const { setHeaders } = await import("../src/settings-cache.js");
  setHeaders({ ipHeader: "X-Forwarded-For", countryHeader: "", asnHeader: "" });

  await events.initEvents();
  webhooks.startWebhooks();

  const fnv1a = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash +=
        (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
  };
  const prng = (seed, length) => {
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
  };
  const solve = (token, c, s, d) =>
    Array.from({ length: c }, (_, i) => {
      const salt = prng(`${token}${i + 1}`, s);
      const target = prng(`${token}${i + 1}d`, d);
      for (let n = 0; ; n++) {
        if (
          createHash("sha256")
            .update(salt + n)
            .digest("hex")
            .startsWith(target)
        )
          return n;
      }
    });

  const app = new Elysia().use(capServer).use(siteverifyServer);
  const SITE_KEY = `t${Math.random().toString(16).slice(2, 11)}`;
  const SECRET_KEY = "sk-analytics-test-secret";
  const baseConfig = {
    challengeCount: 2,
    saltSize: 16,
    difficulty: 1,
    instrumentation: false,
  };

  const setConfig = async (extra = {}) => {
    await db.send("HSET", [
      `key:${SITE_KEY}`,
      "config",
      JSON.stringify({ ...baseConfig, ...extra }),
    ]);
    invalidateKeyCache(SITE_KEY);
  };

  const call = (
    path,
    { ip = "198.51.100.7", ua = "Mozilla/5.0 Chrome/142.0", body } = {},
  ) =>
    app.handle(
      new Request(`http://localhost/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": ip,
          "user-agent": ua,
          origin: "https://shop.example",
          "accept-language": "pt-PT,pt;q=0.9",
        },
        ...(body && { body: JSON.stringify(body) }),
      }),
    );

  const fullSolve = async (opts = {}) => {
    const res = await call(`${SITE_KEY}/challenge`, opts);
    if (res.status !== 200)
      return { status: res.status, stage: "challenge", body: await res.json() };
    const ch = await res.json();
    const solutions = solve(
      ch.token,
      ch.challenge.c,
      ch.challenge.s,
      ch.challenge.d,
    );
    const red = await call(`${SITE_KEY}/redeem`, {
      ...opts,
      body: { token: ch.token, solutions },
    });
    return {
      status: red.status,
      stage: "redeem",
      body: await red.json(),
      challenge: ch,
    };
  };

  beforeAll(async () => {
    await db.send("HSET", [
      `key:${SITE_KEY}`,
      "jwtSecret",
      "analytics-test-jwt-secret-32-bytes!!",
      "secretHash",
      hashSecret(SECRET_KEY),
      "name",
      "analytics test",
    ]);
    await db.sadd("keys", SITE_KEY);
    await setConfig();
  });

  afterAll(async () => {
    await db.send("DEL", [
      `key:${SITE_KEY}`,
      `rules:${SITE_KEY}`,
      `webhooks:${SITE_KEY}`,
    ]);
    await db.srem("keys", SITE_KEY);
    await events.getStore().deleteSite(SITE_KEY);
  });

  describe("event log", () => {
    test("records challenge, redeem and siteverify with request context", async () => {
      const r = await fullSolve();
      expect(r.status).toBe(200);
      const verify = await call("siteverify", {
        body: { secret: SECRET_KEY, response: r.body.token },
      });
      expect((await verify.json()).success).toBe(true);
      await events.flush();

      const { events: rows } = await analytics.listEvents(SITE_KEY, {
        range: "1h",
      });
      const types = rows.map((e) => `${e.type}:${e.outcome}`);
      expect(types).toContain("challenge:pass");
      expect(types).toContain("redeem:pass");
      expect(types).toContain("siteverify:pass");
      const redeem = rows.find((e) => e.type === "redeem");
      expect(redeem.ip).toBe("198.51.100.7");
      expect(redeem.origin).toBe("shop.example");
      expect(redeem.lang).toBe("pt-PT");
      expect(redeem.browser).toBe("Chrome");
      expect(redeem.solve_ms).toBeGreaterThanOrEqual(0);
      expect(redeem.token_id).toBe(r.body.token.split(":")[1]);

      const detail = await analytics.eventDetail(SITE_KEY, redeem.id);
      expect(detail.related.chain.some((e) => e.type === "siteverify")).toBe(
        true,
      );
    });

    test("overview counts outcomes and top dimensions", async () => {
      await call(`${SITE_KEY}/redeem`, {
        body: { token: "nope", solutions: [1] },
      });
      await events.flush();
      const o = await analytics.overview(SITE_KEY, { range: "24h" });
      expect(o.summary.solved).toBeGreaterThanOrEqual(1);
      expect(o.summary.failed).toBeGreaterThanOrEqual(1);
      expect(o.summary.verified).toBeGreaterThanOrEqual(1);
      expect(o.series.reduce((s, b) => s + b.solved, 0)).toBe(o.summary.solved);
      const top = await analytics.topDimensions(SITE_KEY, {
        range: "24h",
        dims: ["reason", "browser", "origin"],
      });
      expect(top.reason.some((r) => r.value === "invalid_token")).toBe(true);
      expect(top.origin[0].value).toBe("shop.example");
    });

    test("filters and text search narrow the list", async () => {
      await fullSolve({ ip: "192.0.2.44" });
      await events.flush();
      const only = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        filters: analytics.parseFilters(["ip:192.0.2.44"]),
      });
      expect(only.events.length).toBeGreaterThan(0);
      expect(only.events.every((e) => e.ip === "192.0.2.44")).toBe(true);
      const excluded = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        filters: analytics.parseFilters(["-ip:192.0.2.44"]),
      });
      expect(excluded.events.some((e) => e.ip === "192.0.2.44")).toBe(false);
      const searched = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        q: "192.0.2",
      });
      expect(searched.events.every((e) => e.ip.startsWith("192.0.2"))).toBe(
        true,
      );
      expect(analytics.parseFilters(["bogus:1", "ip:", "flag:bh_x"])).toEqual([
        { field: "flag", neg: false, value: "bh_x" },
      ]);
    });

    test("paginates with a cursor", async () => {
      const first = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        limit: 2,
      });
      expect(first.events).toHaveLength(2);
      expect(first.next).toBeTruthy();
      const second = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        limit: 2,
        cursor: first.next,
      });
      expect(second.events[0].id).not.toBe(first.events[1].id);
      expect(second.events[0].ts).toBeLessThanOrEqual(first.events[1].ts);
    });
  });

  describe("rules and lists", () => {
    test("a list rule blocks at the challenge", async () => {
      const id = await lists.createList({ name: "test bad ips" });
      await lists.addItems(id, [{ kind: "cidr", value: "203.0.113.0/24" }]);
      await saveRules(SITE_KEY, [
        {
          id: "bad-ips",
          name: "bad ips",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "list", op: "in_list", value: id }],
        },
      ]);
      const blocked = await fullSolve({ ip: "203.0.113.9" });
      expect(blocked.stage).toBe("challenge");
      expect(blocked.status).toBe(403);
      const fine = await fullSolve({ ip: "198.51.100.9" });
      expect(fine.status).toBe(200);
      await events.flush();
      const rows = await analytics.listEvents(SITE_KEY, {
        range: "1h",
        filters: analytics.parseFilters(["rule:bad-ips"]),
      });
      expect(rows.events[0].outcome).toBe("block");
      expect(rows.events[0].reason).toBe("rule:bad-ips");
      await lists.deleteList(id);
    });

    test("harder multiplies the puzzle, flag reaches siteverify", async () => {
      await saveRules(SITE_KEY, [
        {
          id: "pt",
          name: "pt",
          enabled: true,
          match: "all",
          action: "harder",
          factor: 3,
          conditions: [{ field: "lang", op: "starts_with", value: "pt" }],
        },
        {
          id: "chrome-flag",
          name: "chrome",
          enabled: true,
          match: "all",
          action: "flag",
          conditions: [{ field: "browser", op: "eq", value: "chrome" }],
        },
      ]);
      const r = await fullSolve();
      expect(r.challenge.challenge.c).toBe(6);
      const verify = await (
        await call("siteverify", {
          body: { secret: SECRET_KEY, response: r.body.token },
        })
      ).json();
      expect(verify.riskFlags).toContain("rule:chrome-flag");
      expect(verify.rules).toEqual(["pt", "chrome-flag"]);
    });

    test("result rules block at redeem, allow rules skip signal blocks", async () => {
      await saveRules(SITE_KEY, [
        {
          id: "slow",
          name: "slow",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "solve_ms", op: "gte", value: 0 }],
        },
      ]);
      const r = await fullSolve();
      expect(r.stage).toBe("redeem");
      expect(r.status).toBe(403);
      await saveRules(SITE_KEY, [
        {
          id: "office",
          name: "office",
          enabled: true,
          match: "all",
          action: "allow",
          conditions: [{ field: "ip", op: "in", value: ["10.9.0.0/16"] }],
        },
        {
          id: "slow",
          name: "slow",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "solve_ms", op: "gte", value: 0 }],
        },
      ]);
      expect((await fullSolve({ ip: "10.9.3.3" })).status).toBe(200);
      expect((await fullSolve({ ip: "10.8.3.3" })).status).toBe(403);
      await saveRules(SITE_KEY, []);
    });

    test("ip velocity counts challenges per minute", async () => {
      await saveRules(SITE_KEY, [
        {
          id: "burst",
          name: "burst",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "ip_velocity", op: "gt", value: 3 }],
        },
      ]);
      const ip = `198.18.0.${Math.floor(Math.random() * 200) + 1}`;
      const statuses = [];
      for (let i = 0; i < 5; i++)
        statuses.push((await call(`${SITE_KEY}/challenge`, { ip })).status);
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses.at(-1)).toBe(403);
      await saveRules(SITE_KEY, []);
    });

    test("legacy block-ip entries become a list and a rule", async () => {
      const { migrateLegacyBlocks } = await import("../src/policy/rules.js");
      await db.send("HSET", [
        `blocked:${SITE_KEY}`,
        "192.0.2.200",
        "0",
        "asn:SomeHost",
        "0",
      ]);
      await migrateLegacyBlocks();
      expect(await db.exists(`blocked:${SITE_KEY}`)).toBe(false);
      const list = await lists.getList(lists.keyBlocklistId(SITE_KEY));
      expect(list.items.map((i) => `${i.kind}:${i.value}`).sort()).toEqual([
        "ip:192.0.2.200",
        "org:somehost",
      ]);
      expect((await fullSolve({ ip: "192.0.2.200" })).status).toBe(403);
      await saveRules(SITE_KEY, []);
      await lists.deleteList(lists.keyBlocklistId(SITE_KEY));
    });

    test("validation rejects bad rules", async () => {
      const { validateRules } = await import("../src/policy/rules.js");
      expect(
        validateRules([{ name: "x", action: "nuke", conditions: [] }]).error,
      ).toBeTruthy();
      expect(
        validateRules([
          {
            name: "x",
            action: "block",
            conditions: [{ field: "score", op: "contains", value: "a" }],
          },
        ]).error,
      ).toBeTruthy();
      expect(
        validateRules([
          {
            name: "x",
            action: "block",
            conditions: [{ field: "ua", op: "matches", value: "(" }],
          },
        ]).error,
      ).toBeTruthy();
      const ok = validateRules([
        {
          name: "Same",
          action: "flag",
          conditions: [{ field: "country", op: "in", value: "US, CA" }],
        },
        {
          name: "Same",
          action: "flag",
          conditions: [
            { field: "header", header: "Sec-Fetch-Site", op: "exists" },
          ],
        },
      ]);
      expect(ok.rules.map((r) => r.id)).toEqual(["same", "same-2"]);
      expect(ok.rules[0].conditions[0].value).toEqual(["US", "CA"]);
    });
  });

  describe("signal policy", () => {
    test("off strips a flag, block rejects it, agents follow per-agent actions", async () => {
      const { applySignalPolicy } = await import("../src/policy/signals.js");
      const result = {
        riskFlags: ["bh_center_hit", "viewport_override", "agent:browser-use"],
        behavior: {
          agent: {
            detected: true,
            name: "browser-use",
            confidence: "high",
            verified: false,
          },
        },
      };
      const p = applySignalPolicy(
        { signalActions: { bh_center_hit: "off", viewport_override: "block" } },
        result,
      );
      expect(p.flags).toEqual(["viewport_override", "agent:browser-use"]);
      expect(p.blockedBy).toBe("viewport_override");
      expect(p.agentBlocked).toBe(false);
      expect(
        applySignalPolicy({ blockAgents: "identified" }, result).agentBlocked,
      ).toBe(true);
      expect(
        applySignalPolicy(
          {
            blockAgents: "identified",
            agentActions: { "browser-use": "allow" },
          },
          result,
        ).agentBlocked,
      ).toBe(false);
      expect(
        applySignalPolicy({ agentActions: { "*": "block" } }, result)
          .agentBlocked,
      ).toBe(true);
      const verified = {
        behavior: {
          agent: {
            detected: true,
            name: "chatgpt-agent",
            confidence: "high",
            verified: true,
          },
        },
      };
      expect(
        applySignalPolicy(
          { blockAgents: "all", allowVerifiedAgents: true },
          verified,
        ).agentBlocked,
      ).toBe(false);
      const claimed = {
        behavior: {
          agent: { ...verified.behavior.agent, verified: false },
        },
      };
      const allowChatgpt = {
        blockAgents: "all",
        agentActions: { "chatgpt-agent": "allow" },
      };
      expect(applySignalPolicy(allowChatgpt, verified).agentBlocked).toBe(
        false,
      );
      expect(applySignalPolicy(allowChatgpt, claimed).agentBlocked).toBe(true);
    });
  });

  describe("webhooks", () => {
    test("delivers signed events for blocks", async () => {
      process.env.WEBHOOK_ALLOW_PRIVATE = "true";
      const received = [];
      const server = Bun.serve({
        port: 0,
        async fetch(req) {
          received.push({
            sig: req.headers.get("cap-signature"),
            body: await req.text(),
          });
          return new Response("ok");
        },
      });
      const secret = webhooks.newWebhookSecret();
      await webhooks.saveWebhooks(SITE_KEY, [
        {
          id: "wh_test",
          url: `http://localhost:${server.port}/hook`,
          triggers: ["block"],
          enabled: true,
          secret,
        },
      ]);
      await saveRules(SITE_KEY, [
        {
          id: "no-firefox",
          name: "no firefox",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "browser", op: "eq", value: "Firefox" }],
        },
      ]);
      await fullSolve({ ua: "Mozilla/5.0 Firefox/145.0" });
      await fullSolve();
      for (let i = 0; i < 50 && !received.length; i++) await Bun.sleep(20);
      server.stop(true);
      expect(received).toHaveLength(1);
      const [, t, v1] = received[0].sig.match(/^t=(\d+),v1=([0-9a-f]+)$/);
      expect(
        createHmac("sha256", secret)
          .update(`${t}.${received[0].body}`)
          .digest("hex"),
      ).toBe(v1);
      const payload = JSON.parse(received[0].body);
      expect(payload.event.reason).toBe("rule:no-firefox");
      const log = await webhooks.deliveryLog("wh_test");
      expect(log[0].ok).toBe(true);
      await saveRules(SITE_KEY, []);
      await webhooks.saveWebhooks(SITE_KEY, []);
      await db.del("webhook:wh_test:log");
      delete process.env.WEBHOOK_ALLOW_PRIVATE;
    });

    test("refuses private targets and hides the reason", async () => {
      delete process.env.WEBHOOK_ALLOW_PRIVATE;
      let hits = 0;
      const server = Bun.serve({
        port: 0,
        fetch() {
          hits++;
          return new Response("internal");
        },
      });
      const hook = {
        id: "wh_private",
        url: `http://localhost:${server.port}/`,
        triggers: ["all"],
        enabled: true,
        secret: webhooks.newWebhookSecret(),
      };
      for (const url of [
        `http://localhost:${server.port}/`,
        `http://127.0.0.1:${server.port}/`,
        `http://[::ffff:127.0.0.1]:${server.port}/`,
        `http://2130706433:${server.port}/`,
      ]) {
        const res = await webhooks.deliver({ ...hook, url }, { type: "t" });
        expect(res).toEqual({
          ok: false,
          status: 0,
          error: "Couldn't reach the URL",
        });
      }
      const closed = await webhooks.deliver(
        { ...hook, url: "http://127.0.0.1:1/" },
        { type: "t" },
      );
      expect(closed.error).toBe("Couldn't reach the URL");
      server.stop(true);
      expect(hits).toBe(0);
      expect(
        webhooks.validateWebhook({
          url: "http://169.254.169.254/latest",
          triggers: ["all"],
        }).error,
      ).toBe("Webhooks can't point at private or local addresses");
      expect(
        webhooks.validateWebhook({
          url: "http://localhost:8123/?query=SELECT%201",
          triggers: ["all"],
        }).error,
      ).toBe("Webhooks can't point at private or local addresses");
      expect(
        webhooks.validateWebhook({
          url: "https://hooks.example.com/cap",
          triggers: ["all"],
        }).hook.url,
      ).toBe("https://hooks.example.com/cap");
      await db.del("webhook:wh_private:log");
    });

    test("retries drop a hook that was deleted or moved", async () => {
      process.env.WEBHOOK_ALLOW_PRIVATE = "true";
      const received = [];
      let fail = true;
      const server = Bun.serve({
        port: 0,
        fetch(req) {
          received.push(new URL(req.url).pathname);
          return new Response("", { status: fail ? 503 : 200 });
        },
      });
      await webhooks.saveWebhooks(SITE_KEY, [
        {
          id: "wh_retry",
          url: `http://127.0.0.1:${server.port}/old`,
          triggers: ["all"],
          enabled: true,
          secret: webhooks.newWebhookSecret(),
        },
      ]);
      await fullSolve();
      for (let i = 0; i < 100 && !received.length; i++) await Bun.sleep(20);
      await Bun.sleep(400);
      expect(received.length).toBeGreaterThan(0);
      const before = received.length;
      await webhooks.saveWebhooks(SITE_KEY, [
        {
          id: "wh_retry",
          url: `http://127.0.0.1:${server.port}/new`,
          triggers: ["block"],
          enabled: true,
          secret: webhooks.newWebhookSecret(),
        },
      ]);
      fail = false;
      await Bun.sleep(1_300);
      server.stop(true);
      expect(received.slice(before).filter((p) => p === "/old")).toEqual([]);
      await webhooks.saveWebhooks(SITE_KEY, []);
      await db.del("webhook:wh_retry:log");
      delete process.env.WEBHOOK_ALLOW_PRIVATE;
    });
  });

  describe("review fixes", () => {
    const context = () => import("../src/events/context.js");

    test("client IPs are validated and unmapped", async () => {
      const { getClientIp } = await context();
      const req = (xff) =>
        new Request("http://localhost/", {
          headers: xff ? { "x-forwarded-for": xff } : {},
        });
      const srv = { requestIP: () => ({ address: "::ffff:192.0.2.1" }) };
      expect(getClientIp(req("::ffff:203.0.113.9"), srv)).toBe("203.0.113.9");
      expect(getClientIp(req("not-an-ip"), srv)).toBe("192.0.2.1");
      expect(getClientIp(req("1.2.3.4, <script>"), srv)).toBe("192.0.2.1");
      expect(getClientIp(req(), srv)).toBe("192.0.2.1");
      expect(getClientIp(req("2001:db8::1"), srv)).toBe("2001:db8::1");
    });

    test("a mapped IPv4 matches IPv4 rules", async () => {
      await saveRules(SITE_KEY, [
        {
          id: "net",
          name: "net",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [{ field: "ip", op: "in", value: ["203.0.113.0/24"] }],
        },
      ]);
      const res = await call(`${SITE_KEY}/challenge`, {
        ip: "::ffff:203.0.113.9",
      });
      expect(res.status).toBe(403);
      await saveRules(SITE_KEY, []);
    });

    test("truncated IPs drop host bits", async () => {
      const { maskIp } = await context();
      expect(maskIp("2001:db8::dead:beef", "truncate")).toBe("2001:db8:0::");
      expect(maskIp("2001:db8:1:2:3:4:5:6", "truncate")).toBe("2001:db8:1::");
      expect(maskIp("::ffff:203.0.113.9", "truncate")).toBe("203.0.113.0");
      expect(maskIp("::ffff:cb00:7109", "truncate")).toBe("203.0.113.0");
      expect(maskIp("203.0.113.9", "truncate")).toBe("203.0.113.0");
      expect(maskIp("garbage", "truncate")).toBe("");
    });

    test("ASN headers outside the 32 bit range become 0", async () => {
      const { requestContext } = await context();
      setHeaders({
        ipHeader: "X-Forwarded-For",
        countryHeader: "",
        asnHeader: "x-asn",
      });
      const asn = async (value) =>
        (
          await requestContext(
            new Request("http://localhost/", {
              headers: { "x-forwarded-for": "10.0.0.1", "x-asn": value },
            }),
          )
        ).asn;
      try {
        expect(await asn("AS13335")).toBe(13335);
        expect(await asn("4294967295")).toBe(4294967295);
        expect(await asn("1e20")).toBe(0);
        expect(await asn("4294967296")).toBe(0);
        expect(await asn("-5")).toBe(0);
        expect(await asn("Infinity")).toBe(0);
      } finally {
        setHeaders({
          ipHeader: "X-Forwarded-For",
          countryHeader: "",
          asnHeader: "",
        });
      }
    });

    test("velocity reaches rules that also check redeem results", async () => {
      await saveRules(SITE_KEY, [
        {
          id: "burst-redeem",
          name: "burst redeem",
          enabled: true,
          match: "all",
          action: "block",
          conditions: [
            { field: "ip_velocity", op: "gt", value: 2 },
            { field: "flag", op: "not_has", value: "never-set" },
          ],
        },
      ]);
      const ip = `198.18.1.${Math.floor(Math.random() * 200) + 1}`;
      const results = [];
      for (let i = 0; i < 3; i++) results.push(await fullSolve({ ip }));
      expect(results.slice(0, 2).map((r) => r.status)).toEqual([200, 200]);
      expect(results[2].stage).toBe("redeem");
      expect(results[2].status).toBe(403);
      await saveRules(SITE_KEY, []);
    });

    test("a row the store keeps rejecting is dropped, not retried forever", async () => {
      await events.flush();
      const store = events.getStore();
      const insert = store.insert;
      store.insert = async (rows) => {
        if (rows.some((r) => r.reason === "poison")) throw new Error("bad row");
        return insert.call(store, rows);
      };
      const before = (await events.storageStatus()).dropped;
      const warn = console.warn;
      const warnings = [];
      console.warn = (...args) => warnings.push(args.join(" "));
      try {
        const good = [1, 2, 3].map(() =>
          events.recordEvent({
            site_key: SITE_KEY,
            type: "siteverify",
            outcome: "pass",
            reason: "ok",
          }),
        );
        events.recordEvent({
          site_key: SITE_KEY,
          type: "siteverify",
          outcome: "fail",
          reason: "poison",
        });
        for (let i = 0; i < 6 && (await events.storageStatus()).buffered; i++)
          await events.flush();
        const status = await events.storageStatus();
        expect(status.buffered).toBe(0);
        expect(status.dropped).toBe(before + 1);
        expect(
          warnings.filter((w) => w.includes("Dropped event")),
        ).toHaveLength(1);
        for (const e of good)
          expect(await events.getQueries().get(SITE_KEY, e.id)).not.toBe(null);
      } finally {
        store.insert = insert;
        console.warn = warn;
      }
    });

    test("an unreachable store keeps the buffer", async () => {
      await events.flush();
      const store = events.getStore();
      const { insert, ping } = store;
      store.insert = async () => {
        throw new Error("down");
      };
      store.ping = async () => {
        throw new Error("down");
      };
      const before = (await events.storageStatus()).dropped;
      try {
        events.recordEvent({
          site_key: SITE_KEY,
          type: "siteverify",
          outcome: "pass",
          reason: "ok",
        });
        for (let i = 0; i < 5; i++) await events.flush();
        const status = await events.storageStatus();
        expect(status.buffered).toBe(1);
        expect(status.dropped).toBe(before);
      } finally {
        store.insert = insert;
        store.ping = ping;
      }
      await events.flush();
      expect((await events.storageStatus()).buffered).toBe(0);
    });

    test("legacy counters import in batches, skip bad rows and resume", async () => {
      const a = `l${Math.random().toString(16).slice(2, 11)}`;
      const b = `l${Math.random().toString(16).slice(2, 11)}`;
      const start = 400_000;
      const hours = Array.from({ length: 5000 }, (_, i) => String(start + i));
      await db.send("HSET", [
        `metrics:verified:${a}`,
        ...hours.flatMap((h) => [h, "2"]),
        "nope",
        "1",
      ]);
      await db.send("HSET", [
        `metrics:failed:${a}`,
        String(start),
        "1",
        String(start + 1),
        "x",
      ]);
      await db.send("HSET", [`metrics:verified:${b}`, String(start), "7"]);
      await db.sadd("keys", a);
      await db.sadd("keys", b);
      const kind = `fake${Math.random().toString(16).slice(2, 8)}`;
      const inserted = [];
      const seen = [];
      let crashes = 1;
      const target = {
        kind,
        async insertRollups(rows) {
          const mine = rows.filter((r) => [a, b].includes(r.site_key));
          if (!mine.length) return;
          if (!seen.includes(mine[0].site_key)) seen.push(mine[0].site_key);
          if (seen.length === 2 && crashes) {
            crashes--;
            throw new Error("crash");
          }
          inserted.push(...mine);
        },
      };
      try {
        await expect(events.importLegacyCounters(target)).rejects.toThrow(
          "crash",
        );
        expect(await db.get(`analytics:legacy:${kind}`)).toBe(null);
        const [first, second] = seen;
        expect(new Set(inserted.map((r) => r.site_key))).toEqual(
          new Set([first]),
        );
        inserted.length = 0;
        await events.importLegacyCounters(target);
        expect(new Set(inserted.map((r) => r.site_key))).toEqual(
          new Set([second]),
        );
        expect(await db.get(`analytics:legacy:${kind}`)).not.toBe(null);
        expect(await db.exists(`analytics:legacy:${kind}:done`)).toBe(false);
        inserted.length = 0;
        await events.importLegacyCounters(target);
        expect(inserted).toEqual([]);

        const fromA = [];
        await events.importLegacyCounters({
          kind: `${kind}a`,
          async insertRollups(rows) {
            fromA.push(...rows.filter((r) => r.site_key === a));
          },
        });
        await db.del(`analytics:legacy:${kind}a`);
        expect(fromA).toHaveLength(4999);
        expect(fromA.every((r) => Number.isFinite(r.hour))).toBe(true);
        expect(fromA.some((r) => r.hour === (start + 1) * 1000)).toBe(false);

        const store = events.getStore();
        const t0 = performance.now();
        await store.insertRollups(
          hours.map((h) => ({
            site_key: a,
            hour: Number(h) * 1000,
            verified: 2,
            failed: 0,
            ratelimited: 0,
          })),
        );
        expect(performance.now() - t0).toBeLessThan(2000);
        const rolled = await events
          .getQueries()
          .rollups(a, 0, Number.MAX_SAFE_INTEGER);
        expect(rolled).toHaveLength(5000);
      } finally {
        await db.send("DEL", [
          `metrics:verified:${a}`,
          `metrics:failed:${a}`,
          `metrics:verified:${b}`,
          `analytics:legacy:${kind}`,
          `analytics:legacy:${kind}:done`,
        ]);
        await db.srem("keys", a);
        await db.srem("keys", b);
        await events.getStore().deleteSite(a);
      }
    });

    test("ipinfo failures are cached and eviction drops the oldest entry", async () => {
      const ipdb = await import("../src/ipdb.js");
      const saved = await db.get("settings:ipdb");
      const realFetch = globalThis.fetch;
      const calls = [];
      globalThis.fetch = async (url) => {
        calls.push(String(url));
        return new Response("nope", { status: 503 });
      };
      try {
        await db.set(
          "settings:ipdb",
          JSON.stringify({ mode: "ipinfo", ipinfoToken: "test" }),
        );
        await ipdb.loadIPDB();
        const ip = "198.51.100.200";
        await ipdb.lookup(ip);
        await ipdb.lookup(ip);
        expect(calls.filter((u) => u.includes(ip))).toHaveLength(1);
        for (let i = 0; i < 10_000; i++)
          await ipdb.lookup(`2001:db8:ffff::${i.toString(16)}`);
        calls.length = 0;
        await ipdb.lookup(ip);
        await ipdb.lookup("2001:db8:ffff::270f");
        expect(calls.filter((u) => u.includes(ip))).toHaveLength(1);
        expect(calls.filter((u) => u.includes("270f"))).toHaveLength(0);
      } finally {
        globalThis.fetch = realFetch;
        if (saved) await db.set("settings:ipdb", saved);
        else await db.del("settings:ipdb");
        await ipdb.loadIPDB();
      }
    });
  });
}
