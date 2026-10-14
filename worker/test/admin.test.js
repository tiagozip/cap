import { env, SELF } from "cloudflare:test";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { solveChallengeResponse } from "../scripts/solve.js";

const ORIGIN = "https://verify.rakko.cn";
const SITEVERIFY_SECRET = "test-siteverify-secret-0123456789abcdef";
const ADMIN_SUB = "plu_UUHsG7WuUqDXh4R6";
const PRIESTESS = "https://api.rakko.cn/auth/priestess/oidc";

function request(path, init = {}) {
  return SELF.fetch(`${ORIGIN}${path}`, { redirect: "manual", ...init });
}

function postJson(path, body, headers = {}) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function registry() {
  return env.SITE_REGISTRY.getByName("registry");
}

/** A live admin session straight in the registry; returns the cookie header. */
async function adminCookie(sub = ADMIN_SUB) {
  const id = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await registry().createSession(
    sha256(id),
    sub,
    { name: "Rakko", email: null },
    Date.now() + 60_000,
  );
  return `__Host-pv_admin=${id}`;
}

function adminApi(
  path,
  { method = "GET", body, cookie, origin = ORIGIN } = {},
) {
  const headers = { Cookie: cookie };
  if (method !== "GET") {
    headers["content-type"] = "application/json";
    if (origin) headers.Origin = origin;
  }
  return request(`/admin/api${path}`, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
}

async function createSite(cookie, body = {}) {
  const res = await adminApi("/sites", {
    method: "POST",
    cookie,
    body: { name: "Blog", origins: ["https://blog.example"], ...body },
  });
  expect(res.status).toBe(201);
  return res.json();
}

/** Full widget flow against `/<prefix>challenge` + `/<prefix>redeem`. */
async function mintToken(prefix, headers = {}) {
  const challengeRes = await request(`/${prefix}challenge`, {
    method: "POST",
    headers,
  });
  expect(challengeRes.status).toBe(200);
  const challenge = await challengeRes.json();
  const solutions = await solveChallengeResponse(challenge);
  const redeemRes = await postJson(
    `/${prefix}redeem`,
    { token: challenge.token, solutions, instr_blocked: true },
    headers,
  );
  expect(redeemRes.status).toBe(200);
  return (await redeemRes.json()).token;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("registered sites", () => {
  it("runs challenge -> redeem -> siteverify with the site's own secret", async () => {
    const cookie = await adminCookie();
    const { site, secret } = await createSite(cookie);
    expect(site.siteKey).toMatch(/^[0-9a-f]{10}$/);
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(site).not.toHaveProperty("secretHash");

    const token = await mintToken(`${site.siteKey}/`);
    const wrong = await postJson(`/${site.siteKey}/siteverify`, {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(wrong.status).toBe(403);

    const ok = await postJson(`/${site.siteKey}/siteverify`, {
      secret,
      response: token,
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true });

    const replay = await postJson(`/${site.siteKey}/siteverify`, {
      secret,
      response: token,
    });
    expect(replay.status).toBe(404);
  });

  it("keeps tokens of different sites and of the legacy routes apart", async () => {
    const cookie = await adminCookie();
    const a = await createSite(cookie, { name: "A" });
    const b = await createSite(cookie, { name: "B" });

    const tokenA = await mintToken(`${a.site.siteKey}/`);
    const atB = await postJson(`/${b.site.siteKey}/siteverify`, {
      secret: b.secret,
      response: tokenA,
    });
    expect(atB.status).toBe(404);
    const atLegacy = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: tokenA,
    });
    expect(atLegacy.status).toBe(404);
    // A token rewritten to carry the storage suffix is not a token at all.
    const [sig, tokenSecret] = tokenA.split(":");
    const forged = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: `${sig}@${a.site.siteKey}:${tokenSecret}`,
    });
    expect(forged.status).toBe(400);
    // still intact for its own site
    const atA = await postJson(`/${a.site.siteKey}/siteverify`, {
      secret: a.secret,
      response: tokenA,
    });
    expect(atA.status).toBe(200);

    const legacyToken = await mintToken("");
    const legacyAtA = await postJson(`/${a.site.siteKey}/siteverify`, {
      secret: a.secret,
      response: legacyToken,
    });
    expect(legacyAtA.status).toBe(404);
  });

  it("rejects a challenge from one site redeemed at another", async () => {
    const cookie = await adminCookie();
    const a = await createSite(cookie, { name: "A" });
    const b = await createSite(cookie, { name: "B" });
    const challenge = await (
      await request(`/${a.site.siteKey}/challenge`, { method: "POST" })
    ).json();
    const solutions = await solveChallengeResponse(challenge);
    const res = await postJson(`/${b.site.siteKey}/redeem`, {
      token: challenge.token,
      solutions,
      instr_blocked: true,
    });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("scope_mismatch");
  });

  it("answers CORS for the site's origins only", async () => {
    const cookie = await adminCookie();
    const { site } = await createSite(cookie);
    const path = `/${site.siteKey}/challenge`;

    const allowed = await request(path, {
      method: "POST",
      headers: { Origin: "https://blog.example" },
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://blog.example",
    );
    expect(allowed.headers.get("vary")).toBe("Origin");

    const other = await request(path, {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    expect(other.headers.get("access-control-allow-origin")).toBeNull();

    const preflight = await request(path, {
      method: "OPTIONS",
      headers: { Origin: "https://blog.example" },
    });
    expect(preflight.status).toBe(204);
    const deniedPreflight = await request(path, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    expect(deniedPreflight.status).toBe(403);

    const verify = await request(`/${site.siteKey}/siteverify`, {
      method: "OPTIONS",
      headers: { Origin: "https://blog.example" },
    });
    expect(verify.status).toBe(403);
  });

  it("404s unknown and disabled sites", async () => {
    const unknown = await request("/0123456789/challenge", { method: "POST" });
    expect(unknown.status).toBe(404);

    const cookie = await adminCookie();
    const { site } = await createSite(cookie);
    const off = await adminApi(`/sites/${site.siteKey}`, {
      method: "PATCH",
      cookie,
      body: { enabled: false },
    });
    expect(off.status).toBe(200);
    expect((await off.json()).site.enabled).toBe(false);
    const res = await request(`/${site.siteKey}/challenge`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("applies per-site settings", async () => {
    const cookie = await adminCookie();
    const { site } = await createSite(cookie, {
      settings: { challengeCount: 3, challengeDifficulty: 1 },
    });
    const res = await request(`/${site.siteKey}/challenge`, { method: "POST" });
    const body = await res.json();
    expect(body.challenge).toMatchObject({ c: 3, d: 1 });
  });
});

describe("admin API", () => {
  it("requires a session", async () => {
    const res = await adminApi("/sites");
    expect(res.status).toBe(401);
    const me = await adminApi("/me");
    expect(me.status).toBe(401);
  });

  it("drops a session whose sub is no longer allowed", async () => {
    const cookie = await adminCookie("plu_someone_else");
    const res = await adminApi("/me", { cookie });
    expect(res.status).toBe(401);
  });

  it("refuses writes without a same-origin JSON request", async () => {
    const cookie = await adminCookie();
    const crossSite = await adminApi("/sites", {
      method: "POST",
      cookie,
      origin: "https://evil.example",
      body: { name: "x", origins: ["https://x.example"] },
    });
    expect(crossSite.status).toBe(403);

    const form = await request("/admin/api/sites", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=x",
    });
    expect(form.status).toBe(403);
  });

  it("validates input", async () => {
    const cookie = await adminCookie();
    for (const body of [
      { name: "", origins: ["https://a.example"] },
      { name: "x", origins: [] },
      { name: "x", origins: ["http://a.example"] },
      { name: "x", origins: ["https://a.example/path"] },
      {
        name: "x",
        origins: ["https://a.example"],
        settings: { challengeCount: 0 },
      },
      { name: "x", origins: ["https://a.example"], settings: { evil: 1 } },
    ]) {
      const res = await adminApi("/sites", { method: "POST", cookie, body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const local = await adminApi("/sites", {
      method: "POST",
      cookie,
      body: { name: "dev", origins: ["http://localhost:5173"] },
    });
    expect(local.status).toBe(201);
  });

  it("lists, edits, rotates and deletes", async () => {
    const cookie = await adminCookie();
    const { site, secret } = await createSite(cookie, { name: "Rotating" });

    const list = await (await adminApi("/sites", { cookie })).json();
    const listed = list.sites.find((s) => s.siteKey === site.siteKey);
    expect(listed.name).toBe("Rotating");
    expect(JSON.stringify(list)).not.toContain(secret);
    expect(JSON.stringify(list)).not.toContain(sha256(secret));

    const edited = await adminApi(`/sites/${site.siteKey}`, {
      method: "PATCH",
      cookie,
      body: { name: "Renamed", origins: ["https://new.example"] },
    });
    expect((await edited.json()).site).toMatchObject({
      name: "Renamed",
      origins: ["https://new.example"],
    });

    const token = await mintToken(`${site.siteKey}/`);
    const rotated = await adminApi(`/sites/${site.siteKey}/rotate`, {
      method: "POST",
      cookie,
    });
    const { secret: newSecret } = await rotated.json();
    expect(newSecret).not.toBe(secret);
    const old = await postJson(`/${site.siteKey}/siteverify`, {
      secret,
      response: token,
    });
    expect(old.status).toBe(403);
    const fresh = await postJson(`/${site.siteKey}/siteverify`, {
      secret: newSecret,
      response: token,
    });
    expect(fresh.status).toBe(200);

    const deleted = await adminApi(`/sites/${site.siteKey}`, {
      method: "DELETE",
      cookie,
    });
    expect(deleted.status).toBe(200);
    const gone = await request(`/${site.siteKey}/challenge`, {
      method: "POST",
    });
    expect(gone.status).toBe(404);
    const again = await adminApi(`/sites/${site.siteKey}`, {
      method: "DELETE",
      cookie,
    });
    expect(again.status).toBe(404);
  });

  it("logs out", async () => {
    const cookie = await adminCookie();
    const out = await adminApi("/logout", { method: "POST", cookie });
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toContain("__Host-pv_admin=;");
    expect((await adminApi("/me", { cookie })).status).toBe(401);
  });
});

describe("admin pages", () => {
  it("serves the console with a nonce CSP and no caching", async () => {
    const res = await request("/admin");
    expect(res.status).toBe(200);
    const csp = res.headers.get("content-security-policy");
    const nonce = /'nonce-([^']+)'/.exec(csp)[1];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    const html = await res.text();
    // Every <script>/<style> element (their bodies may mention the tags).
    const elements = [
      ...html.matchAll(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1>/g),
    ];
    expect(elements.length).toBeGreaterThanOrEqual(5);
    for (const [, , attrs] of elements) {
      expect(attrs).toContain(`nonce="${nonce}"`);
    }
    expect(html).toContain('href="/admin/login"');

    const second = await request("/admin");
    expect(second.headers.get("content-security-policy")).not.toBe(csp);
  });

  it("serves the callback page", async () => {
    const res = await request("/admin/callback");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("/admin/api/session");
  });
});

/** Answers Priestess calls; everything else goes to the real fetch. */
function mockPriestess({
  sub = ADMIN_SUB,
  appId = "priestess-verification",
  exchangeStatus = 200,
} = {}) {
  const calls = [];
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.startsWith(PRIESTESS)) return realFetch(input, init);
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ path: url.slice(PRIESTESS.length), body, init });
    const reply = (status, value) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.endsWith("/exchange")) {
      if (exchangeStatus !== 200) {
        return reply(exchangeStatus, {
          error: { code: "invalid_login_code", message: "x" },
        });
      }
      return reply(200, { access_token: "at", refresh_token: "rt" });
    }
    if (url.endsWith("/me")) {
      return reply(200, {
        app_id: appId,
        user: { sub, name: "Kurisu Rakko", email: "r@example.com" },
      });
    }
    if (url.endsWith("/logout")) return reply(200, { ok: true });
    return reply(404, {});
  });
  return calls;
}

async function startLogin() {
  const res = await request("/admin/login");
  expect(res.status).toBe(302);
  const location = new URL(res.headers.get("location"));
  const setCookie = res.headers.get("set-cookie");
  const oauthCookie = setCookie.split(";")[0];
  return { location, setCookie, oauthCookie };
}

function finishLogin(oauthCookie, state, loginCode = "code-123") {
  return postJson(
    "/admin/api/session",
    { login_code: loginCode, state },
    { Cookie: oauthCookie, Origin: ORIGIN },
  );
}

describe("Priestess sign-in", () => {
  it("redirects to Priestess with state and S256 PKCE", async () => {
    const { location, setCookie } = await startLogin();
    expect(`${location.origin}${location.pathname}`).toBe(`${PRIESTESS}/login`);
    expect(location.searchParams.get("app_id")).toBe("priestess-verification");
    expect(location.searchParams.get("return_to")).toBe(
      `${ORIGIN}/admin/callback`,
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(location.searchParams.get("state").length).toBeGreaterThanOrEqual(
      16,
    );
    expect(setCookie).toMatch(/^__Host-pv_oauth=/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  it("exchanges the code server-side and opens a session", async () => {
    const calls = mockPriestess();
    const { location, oauthCookie } = await startLogin();
    const res = await finishLogin(
      oauthCookie,
      location.searchParams.get("state"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      user: { name: "Kurisu Rakko", email: "r@example.com" },
    });

    const exchange = calls.find((c) => c.path === "/exchange");
    expect(exchange.body.login_code).toBe("code-123");
    // the verifier matches the challenge sent to /login
    const challenge = createHash("sha256")
      .update(exchange.body.code_verifier)
      .digest("base64url");
    expect(challenge).toBe(location.searchParams.get("code_challenge"));
    expect(new Headers(exchange.init.headers).get("Origin")).toBeNull();
    // the Priestess session is revoked right away
    expect(calls.find((c) => c.path === "/logout").body).toEqual({
      refresh_token: "rt",
    });

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith("__Host-pv_oauth=;"))).toBe(true);
    const session = cookies.find((c) => c.startsWith("__Host-pv_admin="));
    expect(session).toContain("HttpOnly");
    expect(session).toContain("SameSite=Strict");
    const me = await adminApi("/me", { cookie: session.split(";")[0] });
    expect(me.status).toBe(200);
    expect((await me.json()).user.sub).toBe(ADMIN_SUB);
  });

  it("rejects a mismatched or missing state before calling Priestess", async () => {
    const calls = mockPriestess();
    const { oauthCookie } = await startLogin();
    const res = await finishLogin(oauthCookie, "x".repeat(32));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_state");
    const noCookie = await postJson(
      "/admin/api/session",
      { login_code: "c", state: "x".repeat(32) },
      { Origin: ORIGIN },
    );
    expect(noCookie.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("rejects a forged oauth cookie", async () => {
    const calls = mockPriestess();
    const { location, oauthCookie } = await startLogin();
    const [name, value] = oauthCookie.split("=");
    const [payload] = value.split(".");
    const res = await finishLogin(
      `${name}=${payload}.AAAA`,
      location.searchParams.get("state"),
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("refuses a Priestess user who is not an admin", async () => {
    const calls = mockPriestess({ sub: "plu_stranger" });
    const { location, oauthCookie } = await startLogin();
    const res = await finishLogin(
      oauthCookie,
      location.searchParams.get("state"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("not_an_admin");
    expect(
      res.headers.getSetCookie().some((c) => c.startsWith("__Host-pv_admin=")),
    ).toBe(false);
    expect(calls.some((c) => c.path === "/logout")).toBe(true);
  });

  it("refuses a token issued for another app", async () => {
    mockPriestess({ appId: "some-other-app" });
    const { location, oauthCookie } = await startLogin();
    const res = await finishLogin(
      oauthCookie,
      location.searchParams.get("state"),
    );
    expect(res.status).toBe(403);
  });

  it("passes a failed exchange through", async () => {
    mockPriestess({ exchangeStatus: 401 });
    const { location, oauthCookie } = await startLogin();
    const res = await finishLogin(
      oauthCookie,
      location.searchParams.get("state"),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_login_code");
  });

  it("requires a same-origin request", async () => {
    const calls = mockPriestess();
    const { location, oauthCookie } = await startLogin();
    const res = await postJson(
      "/admin/api/session",
      { login_code: "c", state: location.searchParams.get("state") },
      { Cookie: oauthCookie, Origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
