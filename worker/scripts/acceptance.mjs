/**
 * End-to-end acceptance checks against a running Worker.
 *
 *   node scripts/acceptance.mjs http://127.0.0.1:8787
 *
 * Reads the local `SITEVERIFY_SECRET` from the environment (defaults to the
 * value in `.dev.vars.example`). Exits non-zero when any check fails.
 */

import { readFileSync } from "node:fs";
import { postJson, solveChallengeResponse } from "./solve.js";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8787";
const secret =
  process.env.SITEVERIFY_SECRET ??
  "dev-siteverify-secret-change-me-0123456789abcdef";

const failures = [];
const check = (name, ok, detail) => {
  const status = ok ? "PASS" : "FAIL";
  console.log(`${status} ${name}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
  if (!ok) failures.push(name);
};

async function freshRedeem() {
  const challenge = (await postJson(new URL("/challenge", baseUrl))).body;
  const solutions = await solveChallengeResponse(challenge);
  const body = { token: challenge.token, solutions, instr_blocked: true };
  const redeem = await postJson(new URL("/redeem", baseUrl), body);
  return { challenge, body, redeem };
}

// ── challenge shape ────────────────────────────────────────────────────────
const probeChallenge = await postJson(new URL("/challenge", baseUrl));
check(
  "POST /challenge returns token + challenge + instrumentation",
  probeChallenge.status === 200 &&
    typeof probeChallenge.body.token === "string" &&
    typeof probeChallenge.body.challenge?.c === "number" &&
    typeof probeChallenge.body.instrumentation === "string",
  probeChallenge.body,
);

// ── redeem replay ──────────────────────────────────────────────────────────
const { redeem: firstRedeem } = await freshRedeem();
check(
  "POST /redeem succeeds once",
  firstRedeem.status === 200 && firstRedeem.body.success === true,
  firstRedeem,
);
const token = firstRedeem.body.token;

const replay = await freshRedeem();
const replayAgain = await postJson(new URL("/redeem", baseUrl), replay.body);
check(
  "POST /redeem replay is rejected with already_redeemed",
  replayAgain.status === 403 &&
    replayAgain.body.success === false &&
    replayAgain.body.reason === "already_redeemed",
  replayAgain,
);

// ── siteverify single use ──────────────────────────────────────────────────
const verify1 = await postJson(new URL("/siteverify", baseUrl), {
  secret,
  response: token,
});
check(
  "POST /siteverify succeeds once",
  verify1.status === 200 && verify1.body.success === true,
  verify1,
);
const verify2 = await postJson(new URL("/siteverify", baseUrl), {
  secret,
  response: token,
});
check(
  "POST /siteverify replay fails",
  verify2.status === 404 &&
    verify2.body.success === false &&
    verify2.body.error === "Token not found",
  verify2,
);

// ── wrong secret ───────────────────────────────────────────────────────────
const wrongSecret = await postJson(new URL("/siteverify", baseUrl), {
  secret: `${secret}-wrong`,
  response: replay.body.token,
});
check(
  "POST /siteverify with the wrong secret is rejected",
  wrongSecret.status === 403 &&
    wrongSecret.body.success === false &&
    wrongSecret.body.error === "Invalid secret",
  wrongSecret,
);
// the rejected request must not consume the token
const afterWrongSecret = await postJson(new URL("/siteverify", baseUrl), {
  secret,
  response: replay.redeem.body.token,
});
check(
  "a rejected secret does not consume the token",
  afterWrongSecret.status === 200 && afterWrongSecret.body.success === true,
  afterWrongSecret,
);

// ── CORS ───────────────────────────────────────────────────────────────────
// NOTE: `wrangler dev` rewrites the Origin header of requests to the custom
// domain route and rewrites Access-Control-Allow-Origin back to the local dev
// origin in responses, so only the presence of the header can be checked here.
// The exact echoed value is asserted by the vitest pool tests (`SELF.fetch`
// talks to workerd directly, without the dev proxy).
const allowed = await fetch(new URL("/challenge", baseUrl), {
  method: "POST",
  headers: { Origin: "https://verify.rakko.cn" },
});
check(
  "allowed origin gets Access-Control-Allow-Origin",
  allowed.headers.get("access-control-allow-origin") !== null,
  Object.fromEntries(allowed.headers),
);

const sameOrigin = new URL(baseUrl).origin;
const same = await fetch(new URL("/challenge", baseUrl), {
  method: "POST",
  headers: { Origin: sameOrigin },
});
check(
  "same origin gets Access-Control-Allow-Origin",
  same.headers.get("access-control-allow-origin") === sameOrigin,
  Object.fromEntries(same.headers),
);

const denied = await fetch(new URL("/challenge", baseUrl), {
  method: "POST",
  headers: { Origin: "https://evil.example" },
});
check(
  "disallowed origin gets no CORS headers",
  denied.headers.get("access-control-allow-origin") === null,
  Object.fromEntries(denied.headers),
);

const deniedPreflight = await fetch(new URL("/challenge", baseUrl), {
  method: "OPTIONS",
  headers: {
    Origin: "https://evil.example",
    "Access-Control-Request-Method": "POST",
  },
});
check(
  "disallowed preflight gets no CORS headers",
  deniedPreflight.headers.get("access-control-allow-origin") === null,
  Object.fromEntries(deniedPreflight.headers),
);

const allowedPreflight = await fetch(new URL("/challenge", baseUrl), {
  method: "OPTIONS",
  headers: {
    Origin: "https://verify.rakko.cn",
    "Access-Control-Request-Method": "POST",
  },
});
check(
  "allowed preflight is answered with CORS headers",
  allowedPreflight.status === 204 &&
    allowedPreflight.headers.get("access-control-allow-origin") !== null,
  {
    status: allowedPreflight.status,
    acao: allowedPreflight.headers.get("access-control-allow-origin"),
  },
);

const siteverifyCors = await postJson(
  new URL("/siteverify", baseUrl),
  { secret, response: "x:y" },
  { Origin: "https://verify.rakko.cn" },
);
check(
  "/siteverify never echoes the caller origin (the dev proxy may inject its own)",
  siteverifyCors.headers["access-control-allow-origin"] !==
    "https://verify.rakko.cn",
  siteverifyCors.headers,
);

// ── demo shortcut ──────────────────────────────────────────────────────────
const demoCrossOrigin = await postJson(
  new URL("/demo/siteverify", baseUrl),
  { response: replay.redeem.body.token },
  { Origin: "https://evil.example" },
);
check(
  "/demo/siteverify rejects cross-origin callers",
  demoCrossOrigin.status === 403,
  demoCrossOrigin,
);

// ── widget bytes ───────────────────────────────────────────────────────────
const widgetRes = await fetch(new URL("/widget.js", baseUrl));
const widgetBody = Buffer.from(await widgetRes.arrayBuffer());
const widgetFile = readFileSync(
  new URL("../../widget/src/cap.min.js", import.meta.url),
);
check(
  "/widget.js is byte-identical to widget/src/cap.min.js",
  widgetBody.equals(widgetFile),
  { served: widgetBody.length, file: widgetFile.length },
);
check(
  "/widget.js has the expected content type",
  widgetRes.headers.get("content-type") ===
    "application/javascript; charset=utf-8",
  widgetRes.headers.get("content-type"),
);

const floatingRes = await fetch(new URL("/widget-floating.js", baseUrl));
const floatingBody = Buffer.from(await floatingRes.arrayBuffer());
const floatingFile = readFileSync(
  new URL("../../widget/src/cap-floating.min.js", import.meta.url),
);
check(
  "/widget-floating.js is byte-identical to widget/src/cap-floating.min.js",
  floatingBody.equals(floatingFile),
  { served: floatingBody.length, file: floatingFile.length },
);

// ── demo scope isolation ───────────────────────────────────────────────────
async function freshDemoRedeem() {
  const challenge = (await postJson(new URL("/demo/challenge", baseUrl))).body;
  const solutions = await solveChallengeResponse(challenge);
  const body = { token: challenge.token, solutions, instr_blocked: true };
  const redeem = await postJson(new URL("/demo/redeem", baseUrl), body);
  return { challenge, body, redeem };
}

const demoFirst = await freshDemoRedeem();
check(
  "POST /demo/redeem succeeds once",
  demoFirst.redeem.status === 200 && demoFirst.redeem.body.success === true,
  demoFirst.redeem,
);
const demoVerify = await postJson(
  new URL("/demo/siteverify", baseUrl),
  { response: demoFirst.redeem.body.token },
  { Origin: sameOrigin },
);
check(
  "a demo-scoped token verifies at /demo/siteverify",
  demoVerify.status === 200 && demoVerify.body.success === true,
  demoVerify,
);

const demoSecond = await freshDemoRedeem();
const demoAtProd = await postJson(new URL("/siteverify", baseUrl), {
  secret,
  response: demoSecond.redeem.body.token,
});
check(
  "a demo-scoped token never verifies at /siteverify",
  demoAtProd.status === 404 && demoAtProd.body.success === false,
  demoAtProd,
);
const demoStillGood = await postJson(
  new URL("/demo/siteverify", baseUrl),
  { response: demoSecond.redeem.body.token },
  { Origin: sameOrigin },
);
check(
  "the rejected attempt does not consume the demo token",
  demoStillGood.status === 200,
  demoStillGood,
);

const prodSecond = await freshRedeem();
const prodAtDemo = await postJson(
  new URL("/demo/siteverify", baseUrl),
  { response: prodSecond.redeem.body.token },
  { Origin: sameOrigin },
);
check(
  "a production token never verifies at /demo/siteverify",
  prodAtDemo.status === 404 && prodAtDemo.body.success === false,
  prodAtDemo,
);
const prodStillGood = await postJson(new URL("/siteverify", baseUrl), {
  secret,
  response: prodSecond.redeem.body.token,
});
check(
  "a production token still verifies at /siteverify",
  prodStillGood.status === 200,
  prodStillGood,
);

const demoCrossRedeem = await postJson(
  new URL("/demo/redeem", baseUrl),
  (await freshRedeem()).body,
);
check(
  "a production challenge cannot be redeemed at /demo/redeem",
  demoCrossRedeem.status === 403 &&
    demoCrossRedeem.body.reason === "scope_mismatch",
  demoCrossRedeem,
);
const prodCrossRedeem = await postJson(
  new URL("/redeem", baseUrl),
  (await freshDemoRedeem()).body,
);
check(
  "a demo challenge cannot be redeemed at /redeem",
  prodCrossRedeem.status === 403 &&
    prodCrossRedeem.body.reason === "scope_mismatch",
  prodCrossRedeem,
);

// ── Vary: Origin is unconditional ──────────────────────────────────────────
for (const path of [
  "/challenge",
  "/widget.js",
  "/cap_wasm_bg.wasm",
  "/mascot/done.webp",
]) {
  const res = await fetch(new URL(path, baseUrl), {
    method: path === "/challenge" ? "POST" : "GET",
  });
  check(
    `${path} sends Vary: Origin without an Origin header`,
    (res.headers.get("vary") ?? "").includes("Origin"),
    Object.fromEntries(res.headers),
  );
}

// ── self-hosted widget dependencies ────────────────────────────────────────
for (const [path, file, type] of [
  [
    "/cap_wasm_bg.wasm",
    "../../wasm/src/browser/cap_wasm_bg.wasm",
    "application/wasm",
  ],
  ["/hashwx.wasm", "../../wasm/src/browser/hashwx.wasm", "application/wasm"],
  [
    "/pako_inflate.min.js",
    "../vendor/pako_inflate.min.js",
    "application/javascript; charset=utf-8",
  ],
  [
    "/mascot/checking.webp",
    "../../widget/src/mascot/checking.webp",
    "image/webp",
  ],
  ["/mascot/error.webp", "../../widget/src/mascot/error.webp", "image/webp"],
  ["/mascot/done.webp", "../../widget/src/mascot/done.webp", "image/webp"],
]) {
  const res = await fetch(new URL(path, baseUrl));
  const served = Buffer.from(await res.arrayBuffer());
  const repo = readFileSync(new URL(file, import.meta.url));
  check(
    `${path} is byte-identical to ${file}`,
    served.equals(repo) && res.headers.get("content-type") === type,
    {
      served: served.length,
      repo: repo.length,
      type: res.headers.get("content-type"),
    },
  );
}

// The mascot art may be replaced under the same URL, so it must not inherit the
// immutable policy used for the versioned wasm/pako assets.
for (const path of [
  "/mascot/checking.webp",
  "/mascot/error.webp",
  "/mascot/done.webp",
]) {
  const res = await fetch(new URL(path, baseUrl));
  const cacheControl = res.headers.get("cache-control") ?? "";
  check(
    `${path} uses the widget cache policy (not immutable)`,
    cacheControl.includes("max-age=300") && !cacheControl.includes("immutable"),
    cacheControl,
  );
}

console.log(
  failures.length === 0
    ? "\nALL CHECKS PASSED"
    : `\n${failures.length} CHECK(S) FAILED: ${failures.join(", ")}`,
);
if (failures.length > 0) process.exit(1);
