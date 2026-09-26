import { env, runInDurableObject, SELF } from "cloudflare:test";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import capMinJs from "../../widget/src/cap.min.js?raw";
import capFloatingMinJs from "../../widget/src/cap-floating.min.js?raw";
import mascotCheckingWebp from "../../widget/src/mascot/checking.webp";
import mascotDoneWebp from "../../widget/src/mascot/done.webp";
import mascotErrorWebp from "../../widget/src/mascot/error.webp";
import { solveChallengeResponse } from "../scripts/solve.js";
import { readConfig } from "../src/config.js";
import { resolveAllowedOrigin } from "../src/cors.js";
import { handleChallenge, handleRedeem } from "../src/handlers.js";
import { shardNameForKey } from "../src/shards.js";
import { storageKeyFor, tokenSecretHash } from "../src/siteverify.js";

const ORIGIN = "https://verify.rakko.cn";
const CAP_SECRET = "test-cap-secret-0123456789abcdef";
const SITEVERIFY_SECRET = "test-siteverify-secret-0123456789abcdef";
// sha256 of the repo's `wasm/src/browser/*.wasm` and of pako 2.1.0's
// `dist/pako_inflate.min.js` (identical to the jsDelivr copy).
const CAP_WASM_SHA256 =
  "e4f3c00246a775193661f9277ca1288cd310a6514de166ecc2176ccd26fb06a9";
const HASHWX_WASM_SHA256 =
  "b1a0dbb3ef444d3c7069e0a5e0a0273ffa4cf8fef62cbbe43761c02f7cd6aff5";
const PAKO_SHA256 =
  "fa226c8e1e3556993260e6a5c1fe94e225da59b3418a06811fdc51d308f8bb43";

function request(path, init = {}) {
  return SELF.fetch(`${ORIGIN}${path}`, init);
}

function postJson(path, body, headers = {}) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Runs the full widget flow against the test worker and returns the token. */
async function createToken(challengePath = "/challenge", redeemPath = "/redeem") {
  const challengeRes = await request(challengePath, { method: "POST" });
  expect(challengeRes.status).toBe(200);
  const challenge = await challengeRes.json();
  const solutions = await solveChallengeResponse(challenge);
  const redeemRes = await postJson(redeemPath, {
    token: challenge.token,
    solutions,
    instr_blocked: true,
  });
  expect(redeemRes.status).toBe(200);
  const redeem = await redeemRes.json();
  expect(redeem.success).toBe(true);
  return redeem.token;
}

/** A token minted through the demo page's own endpoints (scope "demo"). */
function createDemoToken() {
  return createToken("/demo/challenge", "/demo/redeem");
}

async function sha256HexOf(res) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256")
    .update(Buffer.from(await res.arrayBuffer()))
    .digest("hex");
}

/// Normalises a Data-rule import (ArrayBuffer or typed array) to bytes.
function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}

describe("demo page", () => {
  it("serves a page that mounts the widget and the provenance footer", async () => {
    const res = await request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain(
      '<cap-widget data-cap-api-endpoint="/demo/"></cap-widget>',
    );
    // The mascot card sits next to the default widget and needs no image URL:
    // the widget's default base derives from the /widget.js script directory.
    expect(html).toContain(
      '<cap-widget id="mascot-widget" data-cap-mascot data-cap-api-endpoint="/demo/"></cap-widget>',
    );
    expect(html).not.toContain("CAP_MASCOT_URL");
    expect(html).toContain('<script src="/widget.js"></script>');
    expect(html).toContain('fetch("/demo/siteverify"');
    expect(html).toContain("Based on Cap by Tiago (Apache-2.0)");
    expect(html).not.toContain(SITEVERIFY_SECRET);
    expect(html).not.toContain(CAP_SECRET);
  });

  it("points the widget's wasm and pako fetches at this origin", async () => {
    const html = await (await request("/")).text();
    // The custom URLs have to be set before the widget script loads; the page
    // must not leave any of the three to jsDelivr's defaults.
    const widgetScript = html.indexOf('<script src="/widget.js"></script>');
    for (const [name, path] of [
      ["CAP_CUSTOM_WASM_URL", "/cap_wasm_bg.wasm"],
      ["CAP_CUSTOM_HASHWX_URL", "/hashwx.wasm"],
      ["CAP_PAKO_URL", "/pako_inflate.min.js"],
    ]) {
      const assignment = html.indexOf(`window.${name} = "${path}"`);
      expect(assignment).toBeGreaterThan(-1);
      expect(assignment).toBeLessThan(widgetScript);
    }
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});

describe("widget assets", () => {
  it("serves /widget.js byte-identically to the repo artifact", async () => {
    const res = await request("/widget.js", { headers: { Origin: ORIGIN } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(await res.text()).toBe(capMinJs);
  });

  it("serves /widget-floating.js byte-identically to the repo artifact", async () => {
    const res = await request("/widget-floating.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(capFloatingMinJs);
  });

  it("answers conditional requests with 304", async () => {
    const first = await request("/widget.js");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const second = await request("/widget.js", {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
  });

  it("does not expose the hashwx wasm unless it is enabled", async () => {
    // No `CHALLENGE_PROTOCOLS` opt-in here: the asset is served anyway, because
    // embedders enable hashwx through the widget, not through the Worker.
    const res = await request("/hashwx.wasm");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/wasm");
    expect(await sha256HexOf(res)).toBe(HASHWX_WASM_SHA256);
  });

  it("self-hosts the PoW wasm and pako with the repo's bytes", async () => {
    const capWasm = await request("/cap_wasm_bg.wasm");
    expect(capWasm.status).toBe(200);
    expect(capWasm.headers.get("content-type")).toBe("application/wasm");
    expect(capWasm.headers.get("cache-control")).toContain("immutable");
    expect(await sha256HexOf(capWasm)).toBe(CAP_WASM_SHA256);

    const pako = await request("/pako_inflate.min.js");
    expect(pako.status).toBe(200);
    expect(pako.headers.get("content-type")).toBe(
      "application/javascript; charset=utf-8",
    );
    expect(await sha256HexOf(pako)).toBe(PAKO_SHA256);
  });

  it("serves the data-cap-mascot images with the repo's bytes", async () => {
    for (const [path, expected, length] of [
      ["/mascot/checking.webp", mascotCheckingWebp, 17978],
      ["/mascot/error.webp", mascotErrorWebp, 18200],
      ["/mascot/done.webp", mascotDoneWebp, 18808],
    ]) {
      const res = await request(path, { headers: { Origin: ORIGIN } });
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toBe("image/webp");
      expect(res.headers.get("access-control-allow-origin"), path).toBe(ORIGIN);
      expect(res.headers.get("vary"), path).toBe("Origin");
      // Replaced art must not be pinned for a year like the versioned wasm.
      expect(res.headers.get("cache-control"), path).toBe(
        "public, max-age=300",
      );
      const served = new Uint8Array(await res.arrayBuffer());
      expect(served.byteLength, path).toBe(length);
      expect(
        Buffer.from(served).equals(Buffer.from(toBytes(expected))),
        path,
      ).toBe(true);
    }
  });

  it("answers conditional requests for a mascot image with 304", async () => {
    const first = await request("/mascot/done.webp");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    const second = await request("/mascot/done.webp", {
      headers: { "If-None-Match": etag },
    });
    expect(second.status).toBe(304);
    expect(second.headers.get("content-type")).toBe("image/webp");
  });

  it("does not serve unknown mascot files", async () => {
    const res = await request("/mascot/missing.webp");
    expect(res.status).toBe(404);
  });

  it("sends Vary: Origin unconditionally, with or without an Origin", async () => {
    for (const path of [
      "/widget.js",
      "/widget-floating.js",
      "/cap_wasm_bg.wasm",
      "/hashwx.wasm",
      "/pako_inflate.min.js",
      "/mascot/checking.webp",
      "/mascot/error.webp",
      "/mascot/done.webp",
    ]) {
      const noOrigin = await request(path);
      expect(noOrigin.headers.get("vary"), path).toBe("Origin");
      expect(noOrigin.headers.get("access-control-allow-origin")).toBeNull();

      const withOrigin = await request(path, { headers: { Origin: ORIGIN } });
      expect(withOrigin.headers.get("vary"), path).toBe("Origin");
      expect(withOrigin.headers.get("access-control-allow-origin")).toBe(
        ORIGIN,
      );
    }
  });
});

describe("challenge", () => {
  it("returns a solvable format-1 challenge with instrumentation", async () => {
    const res = await request("/challenge", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    // The test worker overrides CHALLENGE_COUNT/CHALLENGE_DIFFICULTY to keep
    // the solver cheap; the production defaults (50 x 4) are asserted in
    // unit.test.js and against `wrangler dev` by scripts/acceptance.mjs.
    expect(body.challenge).toEqual({ c: 5, s: 32, d: 2 });
    expect(typeof body.token).toBe("string");
    expect(body.expires).toBeGreaterThan(Date.now());

    const script = inflateRawSync(
      Buffer.from(body.instrumentation, "base64"),
    ).toString("utf8");
    expect(script).toContain("cap:instr");
  });

  it("echoes the allowlisted Origin exactly", async () => {
    const res = await request("/challenge", {
      method: "POST",
      headers: { Origin: ORIGIN },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("omits CORS headers for an unknown Origin", async () => {
    const res = await request("/challenge", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("sends Vary: Origin even when the request has none", async () => {
    // The no-Origin variant is what `<script src="/challenge">`-style caches
    // store; without Vary it would be replayed for CORS callers.
    const res = await request("/challenge", { method: "POST" });
    expect(res.status).toBe(200);
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("answers preflight for allowlisted origins and rejects others", async () => {
    const allowed = await request("/challenge", {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(allowed.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );

    const denied = await request("/challenge", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("fails loudly when CAP_SECRET is missing", async () => {
    const config = readConfig({
      CAP_SECRET: "",
      ALLOWED_ORIGINS: ORIGIN,
    });
    const res = await handleChallenge(
      new Request(`${ORIGIN}/challenge`, { method: "POST" }),
      env,
      config,
      null,
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("CAP_SECRET");
  });
});

describe("redeem", () => {
  it("accepts a valid solution and rejects the replay", async () => {
    const challenge = await (
      await request("/challenge", { method: "POST" })
    ).json();
    const solutions = await solveChallengeResponse(challenge);
    const body = { token: challenge.token, solutions, instr_blocked: true };

    const first = await postJson("/redeem", body, { Origin: ORIGIN });
    expect(first.status).toBe(200);
    expect(first.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const firstBody = await first.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.token.split(":")).toHaveLength(2);

    const second = await postJson("/redeem", body, { Origin: ORIGIN });
    expect(second.status).toBe(403);
    expect(await second.json()).toMatchObject({
      success: false,
      reason: "already_redeemed",
    });
  });

  it("rejects a bad payload with 400", async () => {
    const res = await postJson("/redeem", { token: "nope", solutions: [] });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("invalid_token");
  });

  it("rejects an invalid solution", async () => {
    const challenge = await (
      await request("/challenge", { method: "POST" })
    ).json();
    const res = await postJson("/redeem", {
      token: challenge.token,
      solutions: Array.from({ length: challenge.challenge.c }, () => 0),
      instr_blocked: true,
    });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("invalid_solution");
  });
});

describe("siteverify", () => {
  it("verifies a token exactly once", async () => {
    const token = await createToken();
    const first = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ success: true });

    const second = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(second.status).toBe(404);
    expect(await second.json()).toEqual({
      success: false,
      error: "Token not found",
    });
  });

  it("rejects a bad secret without consuming the token", async () => {
    const token = await createToken();
    const bad = await postJson("/siteverify", {
      secret: "wrong-secret",
      response: token,
    });
    expect(bad.status).toBe(403);
    expect(await bad.json()).toEqual({
      success: false,
      error: "Invalid secret",
    });

    const good = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(good.status).toBe(200);
  });

  it("rejects missing and malformed parameters with 400", async () => {
    for (const body of [
      {},
      { secret: SITEVERIFY_SECRET },
      { response: "a:b" },
      { secret: SITEVERIFY_SECRET, response: "not-a-token" },
      { secret: SITEVERIFY_SECRET, response: "a:b:c" },
    ]) {
      const res = await postJson("/siteverify", body);
      expect(res.status).toBe(400);
      expect((await res.json()).success).toBe(false);
    }
  });

  it("returns 403 for an expired token", async () => {
    const id = "deadbeefdeadbeef";
    const secret = "expired-token-secret";
    const key = storageKeyFor(id);
    const stub = env.TOKEN_STORE.getByName(shardNameForKey(key));
    await stub.storeToken(key, Date.now() - 1000, tokenSecretHash(secret));

    const res = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: `${id}:${secret}`,
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: "Token expired",
    });
  });

  it("rejects a production token whose secret was tampered with", async () => {
    const token = await createToken();
    const tampered = `${token.split(":")[0]}:${"0".repeat(30)}`;
    const res = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: tampered,
    });
    expect(res.status).toBe(404);

    // the real token is untouched
    const good = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(good.status).toBe(200);
  });

  it("never returns CORS headers", async () => {
    const token = await createToken();
    const res = await postJson(
      "/siteverify",
      { secret: SITEVERIFY_SECRET, response: token },
      { Origin: ORIGIN },
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("demo siteverify shortcut", () => {
  it("verifies same-origin demo callers without a secret", async () => {
    const token = await createDemoToken();
    const res = await postJson(
      "/demo/siteverify",
      { response: token },
      { Origin: ORIGIN },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("rejects cross-origin callers", async () => {
    const token = await createDemoToken();
    const res = await postJson(
      "/demo/siteverify",
      { response: token },
      { Origin: "https://evil.example" },
    );
    expect(res.status).toBe(403);
    // the token is still unused
    const second = await postJson(
      "/demo/siteverify",
      { response: token },
      { Origin: ORIGIN },
    );
    expect(second.status).toBe(200);
  });

  it("rejects a Sec-Fetch-Site: none request (not a same-origin XHR)", async () => {
    const token = await createDemoToken();
    const res = await postJson(
      "/demo/siteverify",
      { response: token },
      { "Sec-Fetch-Site": "none" },
    );
    expect(res.status).toBe(403);
  });

  it("never accepts a production token (scope + key prefix)", async () => {
    const token = await createToken();
    const res = await postJson(
      "/demo/siteverify",
      { response: token },
      { Origin: ORIGIN },
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: "Token not found",
    });
    // production siteverify still works: nothing was consumed
    const stillGood = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: token,
    });
    expect(stillGood.status).toBe(200);
  });

  it("never accepts a demo token at the production endpoint", async () => {
    const demoToken = await createDemoToken();
    const res = await postJson("/siteverify", {
      secret: SITEVERIFY_SECRET,
      response: demoToken,
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: "Token not found",
    });
    // and the demo token is still consumable by its own endpoint
    const stillGood = await postJson(
      "/demo/siteverify",
      { response: demoToken },
      { Origin: ORIGIN },
    );
    expect(stillGood.status).toBe(200);
  });
});

describe("challenge scopes", () => {
  it("marks demo challenges as scope=demo and production as scope=site", async () => {
    // core embeds the scope in the JWT payload as `sk`; redeem enforces it.
    const demoChallenge = await (
      await request("/demo/challenge", { method: "POST" })
    ).json();
    const prodChallenge = await (
      await request("/challenge", { method: "POST" })
    ).json();
    expect(demoChallenge.token).not.toBe(prodChallenge.token);

    // A demo challenge solved and redeemed through the production endpoints
    // must fail the scope check (not mint a production token).
    const solutions = await solveChallengeResponse(demoChallenge);
    const cross = await postJson("/redeem", {
      token: demoChallenge.token,
      solutions,
      instr_blocked: true,
    });
    expect(cross.status).toBe(403);
    expect(await cross.json()).toMatchObject({
      success: false,
      reason: "scope_mismatch",
    });

    // ...and the other direction too.
    const solutions2 = await solveChallengeResponse(prodChallenge);
    const cross2 = await postJson("/demo/redeem", {
      token: prodChallenge.token,
      solutions: solutions2,
      instr_blocked: true,
    });
    expect(cross2.status).toBe(403);
    expect(await cross2.json()).toMatchObject({
      success: false,
      reason: "scope_mismatch",
    });
  });
});

describe("challenge formats", () => {
  it("supports format 2 with sha256-pow", async () => {
    const config = readConfig({
      CAP_SECRET,
      ALLOWED_ORIGINS: ORIGIN,
      CHALLENGE_PROTOCOLS: "sha256-pow",
      CHALLENGE_COUNT: "1",
    });
    const challenge = await (
      await handleChallenge(
        new Request(`${ORIGIN}/challenge`, { method: "POST" }),
        env,
        config,
        null,
      )
    ).json();
    expect(challenge.format).toBe(2);
    expect(challenge.challenges).toHaveLength(1);
    expect(challenge.challenges[0].protocol).toBe("sha256-pow");

    const solutions = await solveChallengeResponse(challenge);
    const redeem = await handleRedeem(
      new Request(`${ORIGIN}/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: challenge.token,
          solutions,
          instr_blocked: true,
        }),
      }),
      env,
      config,
      null,
    );
    expect(redeem.status).toBe(200);
    expect((await redeem.json()).success).toBe(true);
  });

  it("mints hashwx challenges and rejects bogus solutions", async () => {
    const config = readConfig({
      CAP_SECRET,
      ALLOWED_ORIGINS: ORIGIN,
      CHALLENGE_PROTOCOLS: "hashwx",
      HASHWX_CHALLENGE_COUNT: "1",
    });
    const challenge = await (
      await handleChallenge(
        new Request(`${ORIGIN}/challenge`, { method: "POST" }),
        env,
        config,
        null,
      )
    ).json();
    expect(challenge.format).toBe(2);
    expect(challenge.challenges[0].protocol).toBe("hashwx");
    expect(challenge.challenges[0].payload).toMatchObject({
      d: 1_000_000,
      n: 65_536,
    });
    expect(challenge.challenges[0].payload.c).toMatch(/^[0-9a-f]{64}$/);

    const redeem = await handleRedeem(
      new Request(`${ORIGIN}/redeem`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: challenge.token,
          solutions: [{ nonce: "18446744073709551615" }],
          instr_blocked: true,
        }),
      }),
      env,
      config,
      null,
    );
    expect(redeem.status).toBe(403);
    expect((await redeem.json()).reason).toBe("invalid_solution");
  });
});

describe("cors policy", () => {
  it("allows the request origin itself even with an empty allowlist", () => {
    const req = new Request(`${ORIGIN}/challenge`, {
      headers: { Origin: ORIGIN },
    });
    expect(resolveAllowedOrigin(req, new Set())).toBe(ORIGIN);
  });

  it("allows exactly the configured origins", () => {
    const req = new Request(`${ORIGIN}/challenge`, {
      headers: { Origin: "https://blog.example" },
    });
    expect(resolveAllowedOrigin(req, new Set())).toBeNull();
    expect(resolveAllowedOrigin(req, new Set(["https://blog.example"]))).toBe(
      "https://blog.example",
    );
  });

  it("ignores requests without an Origin header", () => {
    const req = new Request(`${ORIGIN}/challenge`);
    expect(resolveAllowedOrigin(req, new Set([ORIGIN]))).toBeNull();
  });
});

describe("TokenStore", () => {
  it("consumes a nonce exactly once", async () => {
    const stub = env.TOKEN_STORE.getByName(`nonce-${crypto.randomUUID()}`);
    expect(await stub.consumeNonce("aa", 60_000)).toBe(true);
    expect(await stub.consumeNonce("aa", 60_000)).toBe(false);
  });

  it("stores and atomically consumes a token", async () => {
    const stub = env.TOKEN_STORE.getByName(`token-${crypto.randomUUID()}`);
    const expires = Date.now() + 60_000;
    await stub.storeToken("k", expires);
    expect(await stub.consumeToken("k")).toBe(expires);
    expect(await stub.consumeToken("k")).toBeNull();
  });

  it("keeps the consumed row so the challenge cannot be re-claimed", async () => {
    const stub = env.TOKEN_STORE.getByName(`reclaim-${crypto.randomUUID()}`);
    const expires = Date.now() + 60_000;
    expect(await stub.consumeNonce("bb", 60_000, "hash")).toBe(true);
    expect(await stub.consumeToken("bb", "hash")).toBeGreaterThan(Date.now());
    // spent, but the row still blocks a second redeem of the same challenge
    expect(await stub.consumeToken("bb", "hash")).toBeNull();
    expect(await stub.consumeNonce("bb", 60_000, "hash")).toBe(false);
  });

  it("rejects a token whose secret hash does not match", async () => {
    const stub = env.TOKEN_STORE.getByName(`secret-${crypto.randomUUID()}`);
    await stub.consumeNonce("cc", 60_000, "right");
    expect(await stub.consumeToken("cc", "wrong")).toBeNull();
    expect(await stub.consumeToken("cc", "right")).toBeGreaterThan(Date.now());
  });

  it("writes one row per insert, consume and sweep (no secondary index)", async () => {
    const stub = env.TOKEN_STORE.getByName(`rows-${crypto.randomUUID()}`);
    const counts = await runInDurableObject(stub, async (_instance, state) => {
      const sql = state.storage.sql;
      const key = "a".repeat(64);
      const expires = Date.now() + 60_000;
      const insert = sql.exec(
        "INSERT INTO tokens (key, expires, secret) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING",
        key,
        expires,
        "hash",
      );
      const insertRows = insert.rowsWritten;
      const consume = sql.exec(
        "UPDATE tokens SET consumed = 1 WHERE key = ? AND consumed = 0 AND secret = ? RETURNING expires",
        key,
        "hash",
      );
      const consumed = consume.toArray();
      const consumeRows = consume.rowsWritten;
      const sweep = sql.exec(
        "DELETE FROM tokens WHERE expires <= ?",
        expires + 1000,
      );
      const sweepRows = sweep.rowsWritten;
      return {
        insert: insertRows,
        consume: consumeRows,
        sweep: sweepRows,
        returned: consumed.length,
      };
    });
    // 3 row writes per verification, which is what keeps the free plan's
    // 100,000 rows written / day above 33,000 verifications.
    expect(counts).toEqual({
      insert: 1,
      consume: 1,
      sweep: 1,
      returned: 1,
    });
  });

  it("deletes expired rows from the alarm handler", async () => {
    const stub = env.TOKEN_STORE.getByName(`alarm-${crypto.randomUUID()}`);
    await stub.storeToken("expired", Date.now() - 1000);
    await stub.storeToken("live", Date.now() + 60_000);

    const keys = await runInDurableObject(stub, async (instance, state) => {
      await instance.alarm();
      return state.storage.sql
        .exec("SELECT key FROM tokens ORDER BY key")
        .toArray()
        .map((row) => row.key);
    });
    expect(keys).toEqual(["live"]);
  });
});
