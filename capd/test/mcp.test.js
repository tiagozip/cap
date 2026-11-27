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
  redisAvailable = true;
} catch (e) {
  console.warn("[mcp-test] redis not available, skipping:", e.message);
}

if (!redisAvailable) {
  test.skip(`mcp skipped (no redis at ${REDIS_URL})`, () => {});
} else {
  process.env.REDIS_URL = REDIS_URL;
  process.env.REDIS_PREFIX = `mcp-test-${process.pid}:`;
  process.env.ADMIN_KEY ||= "test-admin-key-1234567890";
  process.env.HIDE_RATELIMIT_IP_WARNING = "true";
  process.env.DUCKDB_PATH = `${tmpdir()}/cap-mcp-${process.pid}.duckdb`;

  await (await import("../src/events/index.js")).initEvents();
  const { auth } = await import("../src/auth.js");
  const { server } = await import("../src/server.js");
  const { policyRoutes } = await import("../src/policy-routes.js");
  const { exportRoutes, insightRoutes } = await import(
    "../src/insight-routes.js"
  );
  const { mcpServer, CATALOG, EXCLUDED } = await import("../src/mcp.js");
  const { oauthServer } = await import("../src/oauth.js");
  const { db } = await import("../src/db.js");

  const app = new Elysia()
    .use(auth)
    .use(oauthServer)
    .use(mcpServer(() => app))
    .use(server)
    .use(policyRoutes)
    .use(exportRoutes)
    .use(insightRoutes);

  const call = async (method, path, { body, auth: authHeader, form } = {}) => {
    const headers = {};
    if (authHeader) headers.Authorization = authHeader;
    if (body) headers["Content-Type"] = "application/json";
    if (form) headers["Content-Type"] = "application/x-www-form-urlencoded";
    const res = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: form
          ? new URLSearchParams(form).toString()
          : body
            ? JSON.stringify(body)
            : undefined,
      }),
    );
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
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
  const keyA = (
    await call("POST", "/server/keys", { body: { name: "A" }, auth: admin })
  ).json.siteKey;
  const keyB = (
    await call("POST", "/server/keys", { body: { name: "B" }, auth: admin })
  ).json.siteKey;
  const apiKey = async (body) =>
    (
      await call("POST", "/server/settings/apikeys", {
        body: { name: "agent", ...body },
        auth: admin,
      })
    ).json.apiKey;
  const full = await apiKey({});
  const readonly = await apiKey({ readonly: true });
  const scoped = await apiKey({ siteKeys: [keyA] });

  let nextId = 1;
  const rpc = (token, method, params) =>
    call("POST", "/mcp", {
      auth: `Bearer ${token}`,
      body: { jsonrpc: "2.0", id: nextId++, method, params },
    });
  const tool = async (token, name, args = {}) => {
    const r = await rpc(token, "tools/call", { name, arguments: args });
    const { content, isError } = r.json.result;
    let data = null;
    try {
      data = JSON.parse(content[0].text);
    } catch {}
    return { isError, data, text: content[0].text };
  };

  afterAll(async () => {
    const keys = await db.send("KEYS", ["*"]);
    if (keys.length) await db.send("DEL", keys);
  });

  describe("mcp", () => {
    test("initialize answers with the client's protocol version", async () => {
      const r = await rpc(full, "initialize", {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      });
      expect(r.json.result.protocolVersion).toBe("2025-03-26");
      expect(r.json.result.serverInfo.name).toBe("capd");
      expect(r.json.result.capabilities.tools).toBeDefined();
    });

    test("notifications get 202 with no body", async () => {
      const r = await call("POST", "/mcp", {
        auth: `Bearer ${full}`,
        body: { jsonrpc: "2.0", method: "notifications/initialized" },
      });
      expect(r.status).toBe(202);
    });

    test("it needs an API key or session", async () => {
      const r = await call("POST", "/mcp", {
        body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      });
      expect(r.status).toBe(401);
      const bad = await rpc("nope_nope", "tools/list");
      expect(bad.status).toBe(401);
      expect(r.headers.get("www-authenticate")).toContain(
        "/.well-known/oauth-protected-resource/mcp",
      );
    });

    test("every API route is a tool or deliberately left out", () => {
      const missing = app.routes
        .filter((r) => r.path.startsWith("/server/"))
        .filter((r) => !r.path.startsWith("/server/oauth/"))
        .map((r) => `${r.method} ${r.path}`)
        .filter((k) => !CATALOG[k] && !EXCLUDED.has(k));
      expect(missing).toEqual([]);
      const names = Object.values(CATALOG).map(([n]) => n);
      expect(new Set(names).size).toBe(names.length);
    });

    test("api docs list every tool's endpoint", async () => {
      const r = await call("GET", "/server/api-docs", { auth: admin });
      expect(r.status).toBe(200);
      expect(r.text).toContain("# capd API");
      expect(r.text).toContain("### POST /keys/:siteKey/webhooks");
      expect(r.text).toContain("`triggers`");
    });

    test("read-only keys don't see write tools", async () => {
      const all = (await rpc(full, "tools/list")).json.result.tools.map(
        (t) => t.name,
      );
      const ro = (await rpc(readonly, "tools/list")).json.result.tools.map(
        (t) => t.name,
      );
      expect(all).toContain("create_site_key");
      expect(ro).not.toContain("create_site_key");
      expect(ro).toContain("search_events");
    });

    test("tools call the API with the caller's access", async () => {
      const list = await tool(full, "list_site_keys");
      expect(list.isError).toBe(false);
      expect(list.data.map((k) => k.siteKey).sort()).toEqual(
        [keyA, keyB].sort(),
      );

      const mine = await tool(scoped, "list_site_keys");
      expect(mine.data.map((k) => k.siteKey)).toEqual([keyA]);
      const other = await tool(scoped, "get_site_key", { siteKey: keyB });
      expect(other.isError).toBe(true);

      const write = await tool(readonly, "create_site_key", { name: "x" });
      expect(write.isError).toBe(true);
      expect(write.text).toContain("read-only");
    });

    test("write tools change the server", async () => {
      const r = await tool(full, "update_site_key", {
        siteKey: keyA,
        name: "Renamed",
      });
      expect(r.isError).toBe(false);
      const after = await tool(full, "get_site_key", { siteKey: keyA });
      expect(after.data.key.name).toBe("Renamed");
    });

    test("missing arguments and unknown tools are reported", async () => {
      const r = await tool(full, "get_site_key", {});
      expect(r.isError).toBe(true);
      expect(r.text).toContain("siteKey");
      const u = await rpc(full, "tools/call", { name: "nope" });
      expect(u.json.error.code).toBe(-32602);
    });

    test("batches answer each request", async () => {
      const r = await call("POST", "/mcp", {
        auth: `Bearer ${full}`,
        body: [
          { jsonrpc: "2.0", id: 91, method: "ping" },
          { jsonrpc: "2.0", method: "notifications/initialized" },
          { jsonrpc: "2.0", id: 92, method: "tools/list" },
        ],
      });
      expect(r.json.map((m) => m.id)).toEqual([91, 92]);
    });
  });

  describe("oauth", () => {
    const verifier = "v".repeat(50);
    const challenge = new Bun.CryptoHasher("sha256")
      .update(verifier)
      .digest("base64url");
    const redirectUri = "http://127.0.0.1:33418/callback";

    const authorize = async (scope) => {
      const reg = await call("POST", "/oauth/register", {
        body: { client_name: "Test agent", redirect_uris: [redirectUri] },
      });
      expect(reg.status).toBe(201);
      const clientId = reg.json.client_id;
      const qs = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri.replace("33418", "40001"),
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "xyz",
        ...(scope && { scope }),
      });
      const go = await call("GET", `/oauth/authorize?${qs}`);
      expect(go.status).toBe(302);
      const id = go.headers.get("location").split("/").pop();
      return { clientId, id };
    };

    test("metadata points clients at the authorization server", async () => {
      const pr = await call("GET", "/.well-known/oauth-protected-resource/mcp");
      expect(pr.json.resource).toBe("http://localhost/mcp");
      const as = await call("GET", "/.well-known/oauth-authorization-server");
      expect(as.json.code_challenge_methods_supported).toEqual(["S256"]);
      expect(as.json.registration_endpoint).toBe(
        "http://localhost/oauth/register",
      );
    });

    test("an approved app signs in with PKCE and keeps access after a refresh", async () => {
      const { clientId, id } = await authorize();
      const info = await call("GET", `/server/oauth/requests/${id}`, {
        auth: admin,
      });
      expect(info.json.clientName).toBe("Test agent");
      const agentTry = await call("POST", `/server/oauth/requests/${id}`, {
        auth: `Bot ${full}`,
        body: { allow: true },
      });
      expect(agentTry.status).toBe(403);
      const ok = await call("POST", `/server/oauth/requests/${id}`, {
        auth: admin,
        body: { allow: true, access: "full" },
      });
      const back = new URL(ok.json.redirect);
      expect(back.searchParams.get("state")).toBe("xyz");
      const code = back.searchParams.get("code");

      const wrong = await call("POST", "/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          code_verifier: "w".repeat(50),
        },
      });
      expect(wrong.status).toBe(400);

      const { clientId: c2, id: id2 } = await authorize();
      const ok2 = await call("POST", `/server/oauth/requests/${id2}`, {
        auth: admin,
        body: { allow: true, access: "full" },
      });
      const code2 = new URL(ok2.json.redirect).searchParams.get("code");
      const tok = await call("POST", "/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code: code2,
          client_id: c2,
          redirect_uri: redirectUri.replace("33418", "40001"),
          code_verifier: verifier,
        },
      });
      expect(tok.status).toBe(200);
      expect(tok.json.access_token).toStartWith("capo_");

      const tools = (await rpc(tok.json.access_token, "tools/list")).json.result
        .tools;
      expect(tools.map((t) => t.name)).toContain("create_webhook");
      const created = await tool(tok.json.access_token, "create_list", {
        name: "From an agent",
      });
      expect(created.isError).toBe(false);

      const again = await call("POST", "/oauth/token", {
        form: {
          grant_type: "refresh_token",
          refresh_token: tok.json.refresh_token,
          client_id: c2,
        },
      });
      expect(again.json.access_token).toStartWith("capo_");
      const reused = await call("POST", "/oauth/token", {
        form: {
          grant_type: "refresh_token",
          refresh_token: tok.json.refresh_token,
          client_id: c2,
        },
      });
      expect(reused.status).toBe(400);

      const grants = await call("GET", "/server/oauth/grants", { auth: admin });
      const grant = grants.json.find((g) => g.clientName === "Test agent");
      const log = await call("GET", `/server/oauth/grants/${grant.id}/log`, {
        auth: admin,
      });
      expect(log.json.calls).toHaveLength(1);
      expect(log.json.calls[0]).toMatchObject({
        tool: "create_list",
        status: 200,
      });
      const agentLog = await call(
        "GET",
        `/server/oauth/grants/${grant.id}/log`,
        {
          auth: `Bearer ${again.json.access_token}`,
        },
      );
      expect(agentLog.status).toBe(403);
      await call("DELETE", `/server/oauth/grants/${grant.id}`, { auth: admin });
      const gone = await call("GET", `/server/oauth/grants/${grant.id}/log`, {
        auth: admin,
      });
      expect(gone.status).toBe(404);
      const revoked = await rpc(again.json.access_token, "tools/list");
      expect(revoked.status).toBe(401);
    });

    test("read-only approval hides write tools and denial goes back to the app", async () => {
      const { clientId, id } = await authorize();
      const ok = await call("POST", `/server/oauth/requests/${id}`, {
        auth: admin,
        body: { allow: true, access: "read" },
      });
      const code = new URL(ok.json.redirect).searchParams.get("code");
      const tok = await call("POST", "/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          code_verifier: verifier,
        },
      });
      const names = (
        await rpc(tok.json.access_token, "tools/list")
      ).json.result.tools.map((t) => t.name);
      expect(names).toContain("search_events");
      expect(names).not.toContain("delete_site_key");

      const { id: id2 } = await authorize();
      const no = await call("POST", `/server/oauth/requests/${id2}`, {
        auth: admin,
        body: { allow: false },
      });
      expect(new URL(no.json.redirect).searchParams.get("error")).toBe(
        "access_denied",
      );
    });

    test("an app limited to some site keys only sees those", async () => {
      const { clientId, id } = await authorize();
      const ok = await call("POST", `/server/oauth/requests/${id}`, {
        auth: admin,
        body: { allow: true, siteKeys: [keyB] },
      });
      const code = new URL(ok.json.redirect).searchParams.get("code");
      const tok = await call("POST", "/oauth/token", {
        form: {
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          code_verifier: verifier,
        },
      });
      const keys = await tool(tok.json.access_token, "list_site_keys");
      expect(keys.data.map((k) => k.siteKey)).toEqual([keyB]);
      const other = await tool(tok.json.access_token, "get_site_key", {
        siteKey: keyA,
      });
      expect(other.isError).toBe(true);
      const tools = (await rpc(tok.json.access_token, "tools/list")).json.result
        .tools;
      expect(tools.find((t) => t.name === "list_site_keys").title).toBe(
        "List site keys",
      );
    });

    test("unregistered redirects are refused without redirecting", async () => {
      const reg = await call("POST", "/oauth/register", {
        body: { redirect_uris: ["http://evil.example/cb"] },
      });
      expect(reg.status).toBe(400);
      const { clientId } = await authorize();
      const go = await call(
        "GET",
        `/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: "https://evil.example/cb", code_challenge: challenge, code_challenge_method: "S256" })}`,
      );
      expect(go.status).toBe(400);
      expect(go.headers.get("location")).toBeNull();
    });
  });
}
