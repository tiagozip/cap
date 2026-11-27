import { afterAll, describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
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

if (!redisAvailable) {
  test.skip(`insight routes skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.ADMIN_KEY ||= "test-admin-key-1234567890";
  process.env.DUCKDB_PATH = `${tmpdir()}/cap-insight-${process.pid}-${Date.now()}.duckdb`;

  const events = await import("../src/events/index.js");
  await events.initEvents();
  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { exportRoutes, insightRoutes } = await import(
    "../src/insight-routes.js"
  );
  const { policyRoutes } = await import("../src/policy-routes.js");
  const { shareServer } = await import("../src/share.js");
  const { saveRules } = await import("../src/policy/rules.js");
  const lists = await import("../src/policy/lists.js");
  const { db } = await import("../src/db.js");
  const { setHeaders } = await import("../src/settings-cache.js");
  setHeaders({ ipHeader: "X-Forwarded-For", countryHeader: "", asnHeader: "" });

  const app = new Elysia()
    .use(auth)
    .use(server)
    .use(policyRoutes)
    .use(exportRoutes)
    .use(insightRoutes)
    .use(shareServer);

  let ipCounter = 1;
  const call = async (method, path, { body, auth: authHeader, ip } = {}) => {
    const headers = {
      "x-forwarded-for": ip ?? `203.0.113.${ipCounter++ % 250}`,
    };
    if (authHeader) headers.Authorization = authHeader;
    if (body) headers["Content-Type"] = "application/json";
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, json, text, headers: res.headers };
  };

  const login = await call("POST", "/auth/login", {
    body: { admin_key: process.env.ADMIN_KEY },
  });
  const admin = `Bearer ${btoa(
    JSON.stringify({
      token: login.json.session_token,
      hash: login.json.hashed_token,
    }),
  )}`;
  const siteKey = (
    await call("POST", "/server/keys", {
      body: { name: "Preview" },
      auth: admin,
    })
  ).json.siteKey;

  const now = Date.now();
  const base = { site_key: siteKey, ua: "Mozilla/5.0 Chrome/142.0" };
  const seed = [
    ...Array.from({ length: 6 }, (_, i) => ({
      ...base,
      ts: now - 60_000 * (i + 1),
      type: "redeem",
      outcome: "pass",
      reason: "ok",
      ip: `198.51.100.${i + 1}`,
      country: "PT",
      fp: `v${i}`,
      score: 0.9,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      ...base,
      ts: now - 30_000 * (i + 1),
      type: "redeem",
      outcome: "pass",
      reason: "ok",
      ip: "192.0.2.50",
      country: "RU",
      asn_org: "Bad Hosting",
      fp: "bot",
      score: 0.1,
      flags: ["webdriver"],
    })),
    {
      ...base,
      ts: now - 10_000,
      type: "challenge",
      outcome: "block",
      reason: "rule:block-ru",
      rule: "block-ru",
      ip: "192.0.2.51",
      country: "RU",
    },
    {
      ...base,
      ts: now - 5_000,
      type: "challenge",
      outcome: "pass",
      reason: "ok",
      ip: "198.51.100.1",
      country: "PT",
    },
  ];
  for (const e of seed) events.recordEvent(e);
  await events.flush();

  await saveRules(siteKey, [
    {
      id: "block-ru",
      name: "Block RU",
      enabled: true,
      match: "all",
      conditions: [{ field: "country", op: "eq", value: "RU" }],
      action: "block",
    },
  ]);

  const preview = (rules, extra = {}) =>
    call("POST", `/server/keys/${siteKey}/rules/preview`, {
      body: { rules, ...extra },
      auth: admin,
    });

  afterAll(async () => {
    await call("DELETE", `/server/keys/${siteKey}`, { auth: admin });
  });

  describe("overview compare", () => {
    test("returns the previous window bucketed like the current one", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Compare" },
          auth: admin,
        })
      ).json.siteKey;
      const day = 86_400_000;
      const redeem = (ts, outcome = "pass") =>
        events.recordEvent({
          ...base,
          site_key: key,
          ts,
          type: "redeem",
          outcome,
          reason: "ok",
        });
      for (let i = 0; i < 3; i++) redeem(now - day - 3_600_000 - i);
      redeem(now - day - 60_000, "block");
      redeem(now - 60_000);
      await events.flush();
      try {
        const { json } = await call(
          "GET",
          `/server/keys/${key}/analytics?range=24h`,
          { auth: admin },
        );
        const { series, previousSeries, previous } = json;
        expect(previousSeries).toHaveLength(series.length);
        expect(previousSeries.map((b) => b.b)).toEqual(series.map((b) => b.b));
        const sum = (rows, k) => rows.reduce((a, b) => a + b[k], 0);
        expect(sum(previousSeries, "solved")).toBe(3);
        expect(sum(previousSeries, "blocked")).toBe(1);
        expect(sum(previousSeries, "solved")).toBe(previous.solved);
        expect(sum(series, "solved")).toBe(1);
        const at = (t) =>
          previousSeries.findIndex(
            (b) => b.b <= t + day && t + day < b.b + json.range.bucket,
          );
        expect(previousSeries[at(now - day - 3_600_000)].solved).toBe(3);
        const { legacyKeyStats } = await import("../src/events/analytics.js");
        const legacy = await legacyKeyStats(key, "today");
        expect(legacy.stats).toBeDefined();
      } finally {
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });
  });

  describe("share geo", () => {
    test("geo stats follow the chosen chart duration", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Share geo" },
          auth: admin,
        })
      ).json.siteKey;
      const challenge = (ts, country) =>
        events.recordEvent({
          ...base,
          site_key: key,
          ts,
          type: "challenge",
          outcome: "pass",
          reason: "ok",
          country,
        });
      challenge(now - 60_000, "PT");
      challenge(now - 20 * 86_400_000, "JP");
      await events.flush();
      try {
        const { json: share } = await call(
          "POST",
          `/server/keys/${key}/shares`,
          { body: { name: "geo" }, auth: admin },
        );
        const codes = (json) => json.countries.map((c) => c.code).sort();
        const all = await call("GET", `/share/${share.token}/geo-stats`);
        expect(codes(all.json)).toEqual(["JP", "PT"]);
        expect(all.json.range).toBeUndefined();
        const today = await call(
          "GET",
          `/share/${share.token}/geo-stats?chartDuration=today`,
        );
        expect(codes(today.json)).toEqual(["PT"]);
        expect(today.json.range).toBe("today");
        const month = await call(
          "GET",
          `/share/${share.token}/geo-stats?chartDuration=last28days`,
        );
        expect(codes(month.json)).toEqual(["JP", "PT"]);
        const bad = await call(
          "GET",
          `/share/${share.token}/geo-stats?chartDuration=forever`,
        );
        expect(bad.status).toBe(422);
      } finally {
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });
  });

  describe("check activity", () => {
    test("counts signals and agents with series and the previous period", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Checks" },
          auth: admin,
        })
      ).json.siteKey;
      const day = 86_400_000;
      const redeem = (ts, extra) =>
        events.recordEvent({
          ...base,
          site_key: key,
          ts,
          type: "redeem",
          outcome: "pass",
          reason: "ok",
          ...extra,
        });
      redeem(now - 60_000, { flags: ["webdriver", "rule:x"] });
      redeem(now - 120_000, {
        flags: ["webdriver"],
        outcome: "block",
        agent: "gptbot",
      });
      redeem(now - 180_000, {});
      redeem(now - 8 * day, { flags: ["webdriver", "cdp"] });
      await events.flush();
      try {
        const { status, json } = await call(
          "GET",
          `/server/keys/${key}/analytics/checks?range=7d`,
          { auth: admin },
        );
        expect(status).toBe(200);
        expect(json.range.bucket).toBe(3_600_000);
        expect(json.attempts).toEqual({ current: 3, previous: 1 });
        const wd = json.flags.webdriver;
        expect(wd.n).toBe(2);
        expect(wd.blocked).toBe(1);
        expect(wd.previous).toBe(1);
        expect(wd.series).toHaveLength(168);
        expect(wd.series.reduce((a, b) => a + b, 0)).toBe(2);
        expect(json.flags.cdp).toEqual({
          n: 0,
          blocked: 0,
          previous: 1,
          series: expect.any(Array),
        });
        expect(json.flags["rule:x"]).toBeUndefined();
        expect(json.agents.gptbot.n).toBe(1);
      } finally {
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });
  });

  describe("list hits", () => {
    test("counts traffic per list entry across keys", async () => {
      const id = await lists.createList({ name: `hits-${Date.now()}` });
      await lists.addItems(id, [
        { kind: "ip", value: "192.0.2.50" },
        { kind: "ip", value: "192.0.2.99" },
        { kind: "country", value: "RU" },
        { kind: "org", value: "bad hosting" },
        { kind: "cidr", value: "10.0.0.0/8" },
      ]);
      try {
        const { status, json } = await call(
          "GET",
          `/server/lists/${id}/hits?range=7d`,
          { auth: admin },
        );
        expect(status).toBe(200);
        expect(json.total).toBe(5);
        expect(json.counted).toBe(4);
        expect(json.uncounted).toEqual(["cidr"]);
        expect(json.hits["ip:192.0.2.50"].n).toBeGreaterThanOrEqual(4);
        expect(json.hits["ip:192.0.2.99"]).toBeUndefined();
        expect(json.hits["country:RU"].n).toBeGreaterThanOrEqual(5);
        expect(json.hits["country:RU"].blocked).toBeGreaterThanOrEqual(1);
        expect(json.hits["org:bad hosting"].n).toBeGreaterThanOrEqual(4);
        const missing = await call("GET", "/server/lists/nope/hits", {
          auth: admin,
        });
        expect(missing.status).toBe(404);
      } finally {
        await lists.deleteList(id);
      }
    });
  });

  describe("movers", () => {
    test("surfaces values that moved against overall traffic", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Movers" },
          auth: admin,
        })
      ).json.siteKey;
      const day = 86_400_000;
      const add = (n, at, extra) => {
        for (let i = 0; i < n; i++)
          events.recordEvent({
            ...base,
            site_key: key,
            ts: at - i * 1000,
            type: "redeem",
            outcome: "pass",
            reason: "ok",
            ...extra,
          });
      };
      add(100, now - 60_000, { country: "PT", asn_org: "Home" });
      add(100, now - day - 60_000, { country: "PT", asn_org: "Home" });
      add(80, now - 120_000, {
        country: "VN",
        asn_org: "Cloud",
        flags: ["webdriver"],
      });
      add(2, now - day - 120_000, { country: "VN", asn_org: "Cloud" });
      add(40, now - day - 180_000, { country: "BR", asn_org: "Gone" });
      await events.flush();
      try {
        const { json } = await call(
          "GET",
          `/server/keys/${key}/analytics/movers?range=24h`,
          { auth: admin },
        );
        expect(json.total).toBe(180);
        expect(json.previousTotal).toBe(142);
        const vn = json.movers.find(
          (m) => m.dim === "country" && m.value === "VN",
        );
        expect(vn.n).toBe(80);
        expect(vn.previous).toBe(2);
        expect(vn.change).toBe(39);
        expect(vn.score).toBeGreaterThan(3);
        const br = json.movers.find(
          (m) => m.dim === "country" && m.value === "BR",
        );
        expect(br.n).toBe(0);
        expect(br.score).toBeLessThan(-3);
        expect(json.movers.some((m) => m.value === "PT")).toBe(false);
        expect(
          json.movers.some((m) => m.dim === "flag" && m.value === "webdriver"),
        ).toBe(true);
        expect(Math.abs(json.movers[0].score)).toBeGreaterThanOrEqual(
          Math.abs(json.movers.at(-1).score),
        );
      } finally {
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });
  });

  describe("export", () => {
    test("streams filtered events as csv and ndjson", async () => {
      const csv = await call(
        "GET",
        `/server/keys/${siteKey}/events/export?range=24h&f=country:RU`,
        { auth: admin },
      );
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      expect(csv.headers.get("content-disposition")).toContain(".csv");
      const lines = csv.text.trim().split("\n");
      expect(lines[0].startsWith("time,id,ts,type,outcome")).toBe(true);
      expect(lines).toHaveLength(6);
      expect(lines[1]).toContain("192.0.2.51");
      const nd = await call(
        "GET",
        `/server/keys/${siteKey}/events/export?range=24h&format=ndjson&f=type:redeem&f=country:RU`,
        { auth: admin },
      );
      const rows = nd.text
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(rows).toHaveLength(4);
      expect(rows.every((r) => r.type === "redeem" && r.country === "RU")).toBe(
        true,
      );
      expect(rows[0].flags).toEqual(["webdriver"]);
    });

    test("neutralises spreadsheet formulas and pages past 1000 rows", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Export" },
          auth: admin,
        })
      ).json.siteKey;
      for (let i = 0; i < 1203; i++)
        events.recordEvent({
          ...base,
          site_key: key,
          ts: now - 5_000 - i,
          type: "redeem",
          outcome: "pass",
          reason: "ok",
          ua: i === 0 ? '=HYPERLINK("x")' : base.ua,
        });
      await events.flush();
      await events.flush();
      try {
        const res = await call(
          "GET",
          `/server/keys/${key}/events/export?range=1h`,
          { auth: admin },
        );
        const lines = res.text.trim().split("\n");
        expect(lines).toHaveLength(1204);
        expect(lines[1]).toContain(`"'=HYPERLINK(""x"")"`);
        expect(new Set(lines.slice(1).map((l) => l.split(",")[1])).size).toBe(
          1203,
        );
      } finally {
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });

    test("needs auth and a known key", async () => {
      const anon = await call("GET", `/server/keys/${siteKey}/events/export`);
      expect(anon.status).toBe(401);
      const unknown = await call("GET", "/server/keys/nope/events/export", {
        auth: admin,
      });
      expect(unknown.status).toBe(404);
    });
  });

  describe("sessions", () => {
    test("list who signed in and when the session was last used", async () => {
      const res = await app.handle(
        new Request("http://localhost/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.200",
            "user-agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
          },
          body: JSON.stringify({ admin_key: process.env.ADMIN_KEY }),
        }),
      );
      const made = await res.json();
      const bearer = `Bearer ${btoa(
        JSON.stringify({ token: made.session_token, hash: made.hashed_token }),
      )}`;
      const before = Date.now();
      const { json: list } = await call("GET", "/server/settings/sessions", {
        auth: bearer,
      });
      const mine = list.find((x) => made.hashed_token.endsWith(x.token));
      expect(mine.ua).toContain("Chrome/142");
      expect(mine.browser).toBe("Chrome");
      expect(mine.os).toBe("macOS");
      expect(Date.parse(mine.seen)).toBeGreaterThanOrEqual(before - 1000);
      expect(
        JSON.parse(await db.get(`session:${made.hashed_token}`)),
      ).not.toHaveProperty("seen");
      await call("POST", "/server/logout", { auth: bearer, body: {} });
      expect(await db.get(`session-seen:${made.hashed_token}`)).toBeNull();
    });
  });

  describe("insights", () => {
    test("returns the previous window's flow next to the current one", async () => {
      events.recordEvent({
        ...base,
        ts: now - 30 * 3_600_000,
        type: "siteverify",
        outcome: "pass",
        reason: "ok",
      });
      await events.flush();
      const { insights } = await import("../src/events/analytics.js");
      const out = await insights(siteKey, { range: "24h" });
      expect(out.previousFlow).toEqual([
        { type: "siteverify", outcome: "pass", n: 1 },
      ]);
      expect(out.flow.some((f) => f.type === "siteverify")).toBe(false);
    });
  });

  describe("event context", () => {
    test("shows ip, network and visitor history, lists and matching rules", async () => {
      const key = (
        await call("POST", "/server/keys", {
          body: { name: "Context" },
          auth: admin,
        })
      ).json.siteKey;
      await saveRules(key, [
        {
          id: "block-ru",
          name: "Block RU",
          enabled: true,
          match: "all",
          conditions: [{ field: "country", op: "eq", value: "RU" }],
          action: "block",
        },
        {
          id: "pt",
          name: "PT",
          enabled: true,
          match: "all",
          conditions: [{ field: "country", op: "eq", value: "PT" }],
          action: "flag",
        },
      ]);
      const id = await lists.createList({ name: `ctx-${Date.now()}` });
      await lists.addItems(id, [{ kind: "country", value: "RU" }]);
      const bot = {
        ...base,
        site_key: key,
        type: "redeem",
        outcome: "pass",
        reason: "ok",
        ip: "192.0.2.50",
        country: "RU",
        asn: 64500,
        asn_org: "Bad Hosting",
        fp: "bot",
      };
      events.recordEvent({ ...bot, ts: now - 9_000, outcome: "block" });
      events.recordEvent({ ...bot, ts: now - 8_000, ip: "192.0.2.60" });
      const recorded = events.recordEvent({ ...bot, ts: now - 1_000 });
      events.recordEvent({
        ...bot,
        ts: now - 2_000,
        ip: "198.51.100.77",
        asn: 64501,
        asn_org: "Home",
        country: "PT",
        fp: "human",
      });
      await events.flush();
      try {
        const res = await call(
          "GET",
          `/server/keys/${key}/events/${recorded.id}/context`,
          { auth: admin },
        );
        expect(res.status).toBe(200);
        const { ip, network, visitor, lists: on, rules } = res.json;
        expect(ip.total).toBe(2);
        expect(ip.blocked).toBe(1);
        expect(ip.visitors).toBe(1);
        expect(ip.first).toBe(now - 9_000);
        expect(ip.last).toBe(now - 1_000);
        expect(ip.keys).toBe(2);
        expect(network.total).toBe(3);
        expect(network.asn).toBe(64500);
        expect(network.share).toBe(0.75);
        expect(visitor.total).toBe(3);
        expect(visitor.ips).toBe(2);
        expect(on).toContainEqual({
          id,
          name: expect.any(String),
          kind: "country",
          value: "RU",
        });
        expect(rules.map((r) => r.id)).toEqual(["block-ru"]);
        const { json: made } = await call("POST", "/server/settings/apikeys", {
          body: { name: "ctx-scoped", siteKeys: [key], readonly: true },
          auth: admin,
        });
        const scoped = await call(
          "GET",
          `/server/keys/${key}/events/${recorded.id}/context`,
          { auth: `Bot ${made.apiKey}` },
        );
        expect(scoped.status).toBe(200);
        expect(scoped.json.ip.keys).toBeUndefined();
        expect(scoped.json.lists).toEqual([]);
        expect(scoped.json.ip.total).toBe(2);
        const other = await call(
          "GET",
          `/server/keys/${siteKey}/events/${recorded.id}/context`,
          { auth: `Bot ${made.apiKey}` },
        );
        expect(other.status).toBe(403);
        await call(
          "DELETE",
          `/server/settings/apikeys/${made.apiKey.split("_")[0]}`,
          { auth: admin },
        );
        const missing = await call(
          "GET",
          `/server/keys/${key}/events/nope/context`,
          { auth: admin },
        );
        expect(missing.status).toBe(404);
      } finally {
        await lists.deleteList(id);
        await call("DELETE", `/server/keys/${key}`, { auth: admin });
      }
    });
  });

  describe("rule preview", () => {
    test("counts matches per rule and compares with the saved rules", async () => {
      const res = await preview([
        {
          name: "Low score",
          action: "block",
          conditions: [{ field: "score", op: "lt", value: 0.5 }],
        },
        {
          name: "Flag webdriver",
          action: "flag",
          conditions: [{ field: "flag", op: "has", value: "webdriver" }],
        },
      ]);
      expect(res.status).toBe(200);
      const { rules, totals, sampled, estimated } = res.json;
      expect(sampled).toBe(11);
      expect(estimated).toBe(false);
      const [low, flag] = rules;
      expect(low.id).toBe("low-score");
      expect(low.stage).toBe("redeem");
      expect(low.matched).toBe(4);
      expect(low.decided).toBe(4);
      expect(low.changes.blocked).toBe(4);
      expect(low.estimate).toEqual({ matched: 4, blocked: 4, unblocked: 0 });
      expect(low.ips).toBe(1);
      expect(low.visitors).toBe(1);
      expect(low.top.ip[0]).toEqual({ value: "192.0.2.50", n: 4 });
      expect(low.examples).toHaveLength(4);
      expect(low.examples[0].ip).toBe("192.0.2.50");
      expect(flag.matched).toBe(4);
      expect(flag.decided).toBe(0);
      expect(totals.draft.events).toBe(11);
      expect(totals.draft.block).toBe(4);
      expect(totals.draft.blocked).toBe(4);
      expect(totals.draft.unblocked).toBe(1);
      expect(totals.saved.block).toBe(5);
      expect(totals.saved.blocked).toBe(4);
      expect(totals.saved.unblocked).toBe(0);
    });

    test("request rules count stopped challenges and skip passed ones", async () => {
      const res = await preview([
        {
          name: "RU",
          action: "block",
          conditions: [{ field: "country", op: "eq", value: "RU" }],
        },
      ]);
      const [ru] = res.json.rules;
      expect(ru.stage).toBe("challenge");
      expect(ru.matched).toBe(5);
      expect(ru.stages).toEqual({ challenge: 1, redeem: 4 });
      expect(ru.outcomes.block).toBe(1);
      expect(ru.changes.blocked).toBe(4);
    });

    test("disabled rules report matches but decide nothing", async () => {
      const res = await preview([
        {
          name: "Off",
          enabled: false,
          action: "block",
          conditions: [{ field: "country", op: "eq", value: "PT" }],
        },
      ]);
      const [off] = res.json.rules;
      expect(off.matched).toBe(6);
      expect(off.decided).toBe(0);
      expect(res.json.totals.draft.block).toBe(0);
    });

    test("allow rules count events they would let through", async () => {
      const res = await preview([
        {
          name: "Let RU in",
          action: "allow",
          conditions: [{ field: "country", op: "eq", value: "RU" }],
        },
      ]);
      expect(res.json.rules[0].changes.unblocked).toBe(1);
      expect(res.json.totals.draft.unblocked).toBe(1);
    });

    test("header and velocity conditions are marked unseen", async () => {
      const res = await preview([
        {
          name: "Fast",
          action: "flag",
          conditions: [
            { field: "ip_velocity", op: "gt", value: 10 },
            { field: "header", header: "x-test", op: "exists" },
          ],
        },
      ]);
      expect(res.json.rules[0].unseen.sort()).toEqual([
        "header",
        "ip_velocity",
      ]);
    });

    test("lists resolve like live traffic", async () => {
      const id = await lists.createList({ name: `preview-${Date.now()}` });
      await lists.addItems(id, [{ kind: "ip", value: "192.0.2.50" }]);
      try {
        const res = await preview([
          {
            name: "Listed",
            action: "block",
            conditions: [{ field: "list", op: "in_list", value: id }],
          },
        ]);
        expect(res.status).toBe(200);
        expect(res.json.rules[0].matched).toBe(4);
      } finally {
        await lists.deleteList(id);
      }
    });

    test("rejects invalid rules, missing lists and unknown keys", async () => {
      const bad = await preview([{ name: "", action: "block" }]);
      expect(bad.status).toBe(400);
      const missing = await preview([
        {
          name: "Ghost",
          action: "block",
          conditions: [{ field: "list", op: "in_list", value: "nope" }],
        },
      ]);
      expect(missing.status).toBe(400);
      const unknown = await call("POST", "/server/keys/nope/rules/preview", {
        body: { rules: [] },
        auth: admin,
      });
      expect(unknown.status).toBe(404);
    });

    test("does not save anything", async () => {
      await preview([
        {
          name: "Temp",
          action: "block",
          conditions: [{ field: "country", op: "eq", value: "PT" }],
        },
      ]);
      const saved = JSON.parse(await db.get(`rules:${siteKey}`));
      expect(saved.map((r) => r.id)).toEqual(["block-ru"]);
    });

    test("needs auth", async () => {
      const res = await call("POST", `/server/keys/${siteKey}/rules/preview`, {
        body: { rules: [] },
      });
      expect(res.status).toBe(401);
    });

    test("busy windows are sampled and scaled back up", async () => {
      const busy = (
        await call("POST", "/server/keys", {
          body: { name: "Busy" },
          auth: admin,
        })
      ).json.siteKey;
      for (let i = 0; i < 600; i++)
        events.recordEvent({
          ...base,
          site_key: busy,
          ts: now - 1000 - i * 10,
          type: "redeem",
          outcome: "pass",
          reason: "ok",
          ip: `10.0.${i % 2}.1`,
          country: i % 2 ? "PT" : "ES",
        });
      await events.flush();
      try {
        const res = await call("POST", `/server/keys/${busy}/rules/preview`, {
          body: {
            rules: [
              {
                name: "Spain",
                action: "block",
                conditions: [{ field: "country", op: "eq", value: "ES" }],
              },
            ],
          },
          auth: admin,
        });
        expect(res.json.estimated).toBe(true);
        expect(res.json.sampled).toBe(250);
        expect(res.json.totals.draft.events).toBe(600);
        const [spain] = res.json.rules;
        expect(spain.matched).toBe(125);
        expect(spain.estimate.matched).toBe(300);
      } finally {
        await call("DELETE", `/server/keys/${busy}`, { auth: admin });
      }
    });

    test("rule stats count hits, outcomes and the series", async () => {
      await saveRules(siteKey, [
        {
          id: "block-ru",
          name: "Block RU",
          enabled: true,
          match: "all",
          conditions: [{ field: "country", op: "eq", value: "RU" }],
          action: "block",
        },
        {
          id: "watch",
          name: "Watch",
          enabled: true,
          match: "all",
          conditions: [{ field: "country", op: "eq", value: "PT" }],
          action: "flag",
        },
      ]);
      const extra = [
        {
          ...base,
          ts: now - 2_000,
          type: "redeem",
          outcome: "pass",
          reason: "ok",
          ip: "198.51.100.9",
          fp: "w1",
          flags: ["rule:watch"],
        },
        {
          ...base,
          ts: now - 3_000,
          type: "redeem",
          outcome: "pass",
          reason: "ok",
          ip: "198.51.100.9",
          fp: "w1",
          rule: "watch",
          flags: ["rule:watch", "webdriver"],
        },
        {
          ...base,
          ts: now - 26 * 3_600_000,
          type: "challenge",
          outcome: "block",
          reason: "rule:block-ru",
          rule: "block-ru",
          ip: "192.0.2.9",
        },
        {
          ...base,
          ts: now - 4_000,
          type: "challenge",
          outcome: "block",
          reason: "rule:gone",
          rule: "gone",
          ip: "192.0.2.10",
        },
      ];
      for (const e of extra) events.recordEvent(e);
      await events.flush();
      const res = await call(
        "GET",
        `/server/keys/${siteKey}/rules/stats?range=24h`,
        { auth: admin },
      );
      expect(res.status).toBe(200);
      const { range, rules } = res.json;
      expect(range.bucket).toBe(15 * 60_000);
      const ru = rules["block-ru"];
      expect(ru.hits).toBe(1);
      expect(ru.outcomes.block).toBe(1);
      expect(ru.previous).toBe(1);
      expect(ru.series).toHaveLength(96);
      expect(ru.series.reduce((a, b) => a + b, 0)).toBe(1);
      expect(ru.last).toBe(now - 10_000);
      const watch = rules.watch;
      expect(watch.hits).toBe(2);
      expect(watch.ips).toBe(1);
      expect(watch.visitors).toBe(1);
      expect(rules.gone.removed).toBe(true);
      expect(rules.gone.hits).toBe(1);
      const unknown = await call("GET", "/server/keys/nope/rules/stats", {
        auth: admin,
      });
      expect(unknown.status).toBe(404);
      await saveRules(siteKey, [
        {
          id: "block-ru",
          name: "Block RU",
          enabled: true,
          match: "all",
          conditions: [{ field: "country", op: "eq", value: "RU" }],
          action: "block",
        },
      ]);
    });

    test("is rate limited per client", async () => {
      const ip = "203.0.113.251";
      let last;
      for (let i = 0; i < 61; i++)
        last = await call("GET", "/server/keys/nope/rules/stats", {
          auth: admin,
          ip,
        });
      expect(last.status).toBe(429);
    });
  });
}
