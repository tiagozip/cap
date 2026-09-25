import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("regression e2e skipped", () => {});
} else {
  const { widgetMin, wasmBytes } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "regression-secret-32-bytes-padding-junk-!";

  // core/standalone consume the challenge nonce on the first successful redeem
  // (core/src/index.js "consumeNonce"), so redeeming the same challenge twice
  // must fail with "already_redeemed" → 403. Mocking that here is what lets
  // this suite catch a widget that replays a challenge it already spent.
  const consumedNonces = new Set();
  const consumeNonce = (sigHex) => {
    if (consumedNonces.has(sigHex)) return false;
    consumedNonces.add(sigHex);
    return true;
  };

  // Expiry fixtures: every "/cap-exp-<name>/" endpoint gets isolated counters.
  // The first redeem (the speculative one) issues a short-lived token, later
  // redeems a normal one, so a test can expire the speculative token with a
  // small clock skew while the cold-path token stays valid.
  const expiryScopes = new Map();
  const expiryScope = (name) => {
    let scope = expiryScopes.get(name);
    if (!scope) {
      scope = { challenges: 0, redeems: 0, tokens: [], alreadyRedeemed: 0 };
      expiryScopes.set(name, scope);
    }
    return scope;
  };
  const SHORT_TOKEN_TTL_MS = 1_500;
  const LONG_TOKEN_TTL_MS = 20 * 60 * 1000;
  const EXPIRY_REDEEM_DELAY_MS = 800;

  let server;
  let browser;
  let baseUrl;

  beforeAll(async () => {
    fs.mkdirSync(path.join(__dirname, "fixtures"), { recursive: true });

    const wasmInjection = `<script>window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";</script>`;

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "reattach.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"></div>
<script src="/widget.js"></script>
<script>
  const c = document.getElementById("container");
  for (let i = 0; i < 3; i++) {
    const w = document.createElement("cap-widget");
    w.setAttribute("data-cap-api-endpoint", "/cap/");
    c.appendChild(w);
    if (i < 2) c.removeChild(w);
  }
  document.title = "OK";
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "disconnect.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"></div>
<script src="/widget.js"></script>
<script>
  window.__errors = [];
  window.addEventListener("unhandledrejection", (e) => {
    window.__errors.push("rejection:" + ((e.reason && e.reason.message) || e.reason));
  });
  const c = document.getElementById("container");
  const w = document.createElement("cap-widget");
  w.id = "cap";
  w.setAttribute("data-cap-api-endpoint", "/cap-slow/");
  c.appendChild(w);
  window.__startAndDetach = async () => {
    window.dispatchEvent(new MouseEvent("mousemove"));
    w.solve();
    await new Promise((r) => setTimeout(r, 500));
    c.removeChild(w);
    await new Promise((r) => setTimeout(r, 300));
    return window.__errors;
  };
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "speculative-disconnect.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"></div>
<script src="/widget.js"></script>
<script>
  window.__errors = [];
  window.addEventListener("unhandledrejection", (e) => {
    window.__errors.push("rejection:" + ((e.reason && e.reason.message) || e.reason));
  });
  window.__cycle = async () => {
    const c = document.getElementById("container");
    const w = document.createElement("cap-widget");
    w.setAttribute("data-cap-api-endpoint", "/cap-many/");
    c.appendChild(w);
    window.dispatchEvent(new MouseEvent("mousemove"));
    await new Promise((r) => setTimeout(r, 2800));
    c.removeChild(w);
    await new Promise((r) => setTimeout(r, 600));
    return window.__errors;
  };
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "required.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<form id="form">
  <cap-widget required id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="cap-token"></cap-widget>
  <button type="submit" id="submit">submit</button>
</form>
<div id="formResult"></div>
<script src="/widget.js"></script>
<script>
  document.getElementById("form").addEventListener("submit", (e) => {
    e.preventDefault();
    document.getElementById("formResult").textContent = "submitted";
  });
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "hiddenfield.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<form id="form">
  <cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="my-custom-token"></cap-widget>
</form>
<div id="solveResult"></div>
<script src="/widget.js"></script>
<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    document.getElementById("solveResult").textContent = e.detail.token;
  });
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "remount.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"><cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="cap-token"></cap-widget></div>
<script src="/widget.js"></script>
<script>
  window.__waitFor = async (fn, timeout = 10_000) => {
    const t0 = performance.now();
    while (performance.now() - t0 < timeout) {
      if (fn()) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };
  window.__remountDuringSolve = async () => {
    const w = document.getElementById("cap");
    const c = document.getElementById("container");
    const events = [];
    w.addEventListener("solve", (e) =>
      events.push({ t: Math.round(performance.now()), token: e.detail.token }),
    );
    const stale = w.solve();
    await new Promise((r) => setTimeout(r, 300)); // still inside the 1000ms wait
    c.removeChild(w);
    c.appendChild(w);
    await new Promise((r) => setTimeout(r, 200));
    const root = w.shadowRoot;
    const captcha = root.querySelector(".captcha");
    const mid = {
      state: captcha.getAttribute("data-state"),
      label: root.querySelector(".label.active")?.textContent ?? null,
      triggers: root.querySelectorAll(".captcha-trigger").length,
      disabled: root
        .querySelector(".captcha-trigger")
        .hasAttribute("disabled"),
      children: [...captcha.children].map((n) => n.className),
    };
    const staleSettled = await Promise.race([
      stale.then(
        (v) => ({ settled: true, value: v ?? null }),
        (e) => ({ settled: true, rejected: String((e && e.message) || e) }),
      ),
      new Promise((r) => setTimeout(() => r({ settled: false }), 3_000)),
    ]);
    // the user clicks the one visible trigger: must start a fresh solve
    root.querySelector(".captcha-trigger").click();
    const gotToken = await window.__waitFor(() => !!w.token);
    return {
      mid,
      staleSettled,
      gotToken,
      final: {
        state: captcha.getAttribute("data-state"),
        label: root.querySelector(".label.active")?.textContent ?? null,
        triggers: root.querySelectorAll(".captcha-trigger").length,
        token: w.token,
        input: document.querySelector("input[name='cap-token']")?.value ?? null,
      },
      events,
    };
  };
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "reset-solve.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"><cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="cap-token"></cap-widget></div>
<script src="/widget.js"></script>
<script>
  window.__resetThenSolve = async () => {
    const w = document.getElementById("cap");
    const events = [];
    w.addEventListener("solve", (e) =>
      events.push({ t: Math.round(performance.now()), token: e.detail.token }),
    );
    const settle = (p) =>
      Promise.race([
        p.then(
          (v) => ({ settled: true, value: v ?? null }),
          (e) => ({ settled: true, rejected: String((e && e.message) || e) }),
        ),
        new Promise((r) => setTimeout(() => r({ settled: false }), 15_000)),
      ]);
    const first = w.solve();
    await new Promise((r) => setTimeout(r, 250)); // in-flight, inside the wait
    w.reset();
    const afterReset = {
      state: w.shadowRoot.querySelector(".captcha").getAttribute("data-state"),
      disabled: w.shadowRoot
        .querySelector(".captcha-trigger")
        .hasAttribute("disabled"),
      token: w.token,
    };
    const second = w.solve(); // must start a new solve right away
    const secondResult = await settle(second);
    const firstResult = await settle(first);
    await new Promise((r) => setTimeout(r, 300)); // catch any late writes
    return {
      afterReset,
      firstResult,
      secondResult,
      events,
      final: {
        state: w.shadowRoot.querySelector(".captcha").getAttribute("data-state"),
        label: w.shadowRoot.querySelector(".label.active")?.textContent ?? null,
        token: w.token,
        input: document.querySelector("input[name='cap-token']")?.value ?? null,
      },
    };
  };
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "speculative-remount.html"),
      `<!DOCTYPE html>
<html><head>${wasmInjection}</head><body>
<div id="container"><cap-widget id="cap" data-cap-api-endpoint="/cap-delayed/" data-cap-hidden-field-name="cap-token"></cap-widget></div>
<script src="/widget.js"></script>
<script>
  window.__speculativeRemount = async () => {
    const w = document.getElementById("cap");
    const c = document.getElementById("container");
    const root = w.shadowRoot;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const waitFor = async (fn, timeout = 15_000) => {
      const t0 = performance.now();
      while (performance.now() - t0 < timeout) {
        if (fn()) return true;
        await sleep(50);
      }
      return false;
    };
    const errors = [];
    window.addEventListener("unhandledrejection", (e) =>
      errors.push("rejection:" + ((e.reason && e.reason.message) || e.reason)),
    );
    window.dispatchEvent(new MouseEvent("mousemove")); // speculative after 2500ms
    await sleep(2600); // speculative is now blocked in the delayed redeem
    const stale = w.solve(); // enters the speculative wait branch
    await sleep(300);
    c.removeChild(w);
    c.appendChild(w);
    await sleep(200);
    const mid = {
      triggers: root.querySelectorAll(".captcha-trigger").length,
      state: root.querySelector(".captcha").getAttribute("data-state"),
      disabled: root.querySelector(".captcha-trigger").hasAttribute("disabled"),
    };
    const staleResult = await Promise.race([
      stale.then(
        (v) => ({ settled: true, value: v ?? null }),
        (e) => ({ settled: true, rejected: String((e && e.message) || e) }),
      ),
      sleep(3_000).then(() => ({ settled: false })),
    ]);
    root.querySelector(".captcha-trigger").click();
    const gotToken = await waitFor(() => !!w.token);
    return {
      mid,
      staleResult,
      gotToken,
      token: w.token,
      state: root.querySelector(".captcha").getAttribute("data-state"),
      errors,
    };
  };
</script>
</body></html>`,
    );

    fs.writeFileSync(
      path.join(__dirname, "fixtures", "expiry.html"),
      `<!DOCTYPE html>
<html><head>
<script>
  // Controllable clock: the widget compares Date.now() against the token
  // expiry, so jumping the clock forward expires a cached token without
  // touching the performance.now()-based minimum display timer.
  var __realNow = Date.now.bind(Date);
  var __skewMs = 0;
  Date.now = function () { return __realNow() + __skewMs; };
  window.__skew = function (ms) { __skewMs += ms; };
  var SKEW_MS = 10000;
</script>
${wasmInjection}</head><body>
<cap-widget id="cap" data-cap-hidden-field-name="cap-token"></cap-widget>
<script src="/widget.js"></script>
<script>
  window.__expiryCase = async (mode) => {
    const w = document.getElementById("cap");
    const root = w.shadowRoot;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    w.setAttribute("data-cap-api-endpoint", "/cap-exp-" + mode + "/");

    const readLog = async () =>
      (await fetch("/cap-exp-" + mode + "/log")).json();
    const waitForLog = async (fn, timeout = 15000) => {
      const t = performance.now();
      while (performance.now() - t < timeout) {
        if (fn(await readLog())) return true;
        await sleep(20);
      }
      return false;
    };

    const errors = [];
    window.addEventListener("unhandledrejection", (e) =>
      errors.push("rejection:" + ((e.reason && e.reason.message) || e.reason)));
    w.addEventListener("error", (e) =>
      errors.push("error:" + ((e.detail && e.detail.code) || "") +
        ":" + ((e.detail && e.detail.message) || "")));

    const events = { progress: [], solve: [], reset: [] };
    w.addEventListener("progress", (e) =>
      events.progress.push({ progress: e.detail.progress, t: performance.now() }));
    w.addEventListener("solve", (e) =>
      events.solve.push({ token: e.detail.token, t: performance.now() }));
    w.addEventListener("reset", () => events.reset.push(performance.now()));

    // data-state trace: dropping the spent speculative state must be in place,
    // so the UI may never flash back to the empty/idle state mid-solve
    const captcha = root.querySelector(".captcha");
    const states = [];
    const observer = new MutationObserver(() => {
      const state = captcha.getAttribute("data-state");
      if (states[states.length - 1] !== state) states.push(state);
    });
    observer.observe(captcha, {
      attributes: true,
      attributeFilter: ["data-state"],
    });

    // One-shot skew: applied the moment the widget announces it is about to
    // wait out the minimum display time for a *cached* token (progress 100),
    // which is exactly after the token was found valid.
    let skewed = false;
    const skewOnCommitWait = () => {
      w.addEventListener("progress", (e) => {
        if (skewed || e.detail.progress !== 100) return;
        skewed = true;
        window.__skew(SKEW_MS);
      });
    };

    window.dispatchEvent(new MouseEvent("mousemove")); // speculative after 2500ms
    let sawToken = false;
    if (mode === "idle") {
      // speculative token issued, then already expired when solve() starts
      sawToken = await waitForLog((l) => l.tokens.length >= 1);
      await sleep(250);
      window.__skew(SKEW_MS);
    } else if (mode === "wait") {
      // token valid at solve() entry, expires during the 1000ms wait
      sawToken = await waitForLog((l) => l.tokens.length >= 1);
      await sleep(250);
      skewOnCommitWait();
    } else {
      // solve() while the speculative redeem is still in flight: the token
      // arrives valid, then expires during the remaining wait
      sawToken = await waitForLog((l) => l.redeems >= 1);
      skewOnCommitWait();
    }

    const t0 = performance.now();
    let result = null;
    let rejected = null;
    try {
      result = await w.solve();
    } catch (e) {
      rejected = String((e && e.message) || e);
    }
    const ms = performance.now() - t0;
    await sleep(400); // let late writes land
    return {
      mode,
      sawToken,
      t0,
      ms,
      result: result === undefined ? null : result,
      rejected,
      errors,
      events,
      states,
      resets: events.reset.length,
      log: await readLog(),
      ui: {
        state: root.querySelector(".captcha").getAttribute("data-state"),
        label: root.querySelector(".label.active")?.textContent ?? null,
        token: w.token,
        input: document.querySelector("input[name='cap-token']")?.value ?? null,
      },
    };
  };
</script>
</body></html>`,
    );

    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: async (req) => {
        const url = new URL(req.url);
        if (url.pathname === "/widget.js") {
          return new Response(widgetMin, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
        if (url.pathname === "/cap_wasm_bg.wasm") {
          return new Response(wasmBytes, {
            headers: { "Content-Type": "application/wasm" },
          });
        }
        if (url.pathname === "/cap/challenge" && req.method === "POST") {
          const r = await generateChallenge(SECRET, {
            challengeCount: 3,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "regression",
          });
          return Response.json(r);
        }
        if (url.pathname === "/cap-many/challenge" && req.method === "POST") {
          const r = await generateChallenge(SECRET, {
            challengeCount: 10,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "regression",
          });
          return Response.json(r);
        }
        if (url.pathname === "/cap-slow/challenge" && req.method === "POST") {
          const r = await generateChallenge(SECRET, {
            challengeCount: 3,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "regression",
          });
          return Response.json(r);
        }
        if (url.pathname === "/cap-slow/redeem" && req.method === "POST") {
          await new Promise((r) => setTimeout(r, 3000));
          return Response.json({ success: false, error: "too slow" });
        }
        if (url.pathname === "/cap-delayed/challenge" && req.method === "POST") {
          const r = await generateChallenge(SECRET, {
            challengeCount: 1,
            challengeSize: 8,
            challengeDifficulty: 1,
            scope: "regression",
          });
          return Response.json(r);
        }
        if (url.pathname === "/cap-delayed/redeem" && req.method === "POST") {
          // keep the speculative pipeline "in flight" long enough to unmount
          // the widget while solve() is waiting on it
          await new Promise((r) => setTimeout(r, 1200));
          let body;
          try {
            body = await req.json();
          } catch {
            return Response.json(
              { success: false, error: "Bad JSON" },
              { status: 400 },
            );
          }
          const result = await validateChallenge(SECRET, body, {
            scope: "regression",
            consumeNonce,
          });
          if (!result.success) {
            return Response.json(
              { success: false, error: result.reason },
              { status: 403 },
            );
          }
          return Response.json({
            success: true,
            token: result.token,
            expires: result.expires,
          });
        }
        const expMatch = url.pathname.match(
          /^\/cap-exp-([a-z0-9-]+)\/(challenge|redeem|log)$/,
        );
        if (expMatch) {
          const scope = expiryScope(expMatch[1]);
          if (expMatch[2] === "log") {
            return Response.json({
              challenges: scope.challenges,
              redeems: scope.redeems,
              tokens: scope.tokens,
              alreadyRedeemed: scope.alreadyRedeemed,
            });
          }
          if (expMatch[2] === "challenge" && req.method === "POST") {
            scope.challenges++;
            const r = await generateChallenge(SECRET, {
              challengeCount: 1,
              challengeSize: 8,
              challengeDifficulty: 1,
              scope: `exp-${expMatch[1]}`,
            });
            return Response.json(r);
          }
          if (expMatch[2] === "redeem" && req.method === "POST") {
            // count on arrival so tests can tell a redeem is in flight
            scope.redeems++;
            await new Promise((r) => setTimeout(r, EXPIRY_REDEEM_DELAY_MS));
            let body;
            try {
              body = await req.json();
            } catch {
              return Response.json(
                { success: false, error: "Bad JSON" },
                { status: 400 },
              );
            }
            const result = await validateChallenge(SECRET, body, {
              scope: `exp-${expMatch[1]}`,
              consumeNonce,
              tokenTtlMs:
                scope.tokens.length === 0
                  ? SHORT_TOKEN_TTL_MS
                  : LONG_TOKEN_TTL_MS,
            });
            if (!result.success) {
              if (result.reason === "already_redeemed") scope.alreadyRedeemed++;
              return Response.json(
                { success: false, error: result.reason },
                { status: 403 },
              );
            }
            scope.tokens.push(result.token);
            return Response.json({
              success: true,
              token: result.token,
              expires: result.expires,
            });
          }
        }
        if (url.pathname === "/cap/redeem" && req.method === "POST") {
          let body;
          try {
            body = await req.json();
          } catch {
            return Response.json(
              { success: false, error: "Bad JSON" },
              { status: 400 },
            );
          }
          const result = await validateChallenge(SECRET, body, {
            scope: "regression",
            consumeNonce,
          });
          if (!result.success) {
            return Response.json(
              { success: false, error: result.reason },
              { status: 403 },
            );
          }
          return Response.json({
            success: true,
            token: result.token,
            expires: result.expires,
          });
        }
        if (url.pathname.startsWith("/page/")) {
          const html = fs.readFileSync(
            path.join(
              __dirname,
              "fixtures",
              `${url.pathname.split("/").pop()}.html`,
            ),
            "utf-8",
          );
          return new Response(html, {
            headers: { "Content-Type": "text/html" },
          });
        }
        return new Response("not found", { status: 404 });
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;

    browser = await chromium.launch({ headless: true });
  }, 120_000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  describe("regression e2e", () => {
    test("regression: shadow root re-attach (#243/#250) — repeated mount survives", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/page/reattach`, { waitUntil: "load" });
      await page.waitForFunction(() => document.title === "OK", null, {
        timeout: 5_000,
      });
      await new Promise((r) => setTimeout(r, 500));
      expect(errors.filter((e) => /shadow|attachShadow/i.test(e))).toEqual([]);
      const widgets = await page.evaluate(
        () => document.querySelectorAll("cap-widget").length,
      );
      expect(widgets).toBe(1);
      await page.close();
    }, 30_000);

    test("regression: disconnect during in-flight solve does not throw", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/page/disconnect`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const rejections = await page.evaluate(() => window.__startAndDetach());

      expect(rejections).toEqual([]);
      expect(errors.filter((e) => /\bstate\b|null|undefined/i.test(e))).toEqual(
        [],
      );
      await page.close();
    }, 30_000);

    test("regression: unmount during speculative solve does not throw (#302)", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/page/speculative-disconnect`, {
        waitUntil: "load",
      });
      await page.waitForFunction(
        () => !!customElements.get("cap-widget"),
        null,
        { timeout: 10_000 },
      );

      const rejections = await page.evaluate(() => window.__cycle());

      expect(rejections).toEqual([]);
      expect(errors).toEqual([]);
      await page.close();
    }, 30_000);

    test("regression: required attribute blocks submit before solve (#227)", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/required`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );
      await page.click("#submit", { force: true });
      await new Promise((r) => setTimeout(r, 500));
      const submitted = await page.evaluate(
        () => document.getElementById("formResult").textContent,
      );
      expect(submitted).toBe("");
      await page.close();
    }, 30_000);

    test("regression: hidden field uses custom name and is set on solve", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/hiddenfield`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const fieldExists = await page.evaluate(
        () =>
          !!document.querySelector("cap-widget input[name='my-custom-token']"),
      );
      expect(fieldExists).toBe(true);

      await page.evaluate(() => document.getElementById("cap").solve());
      await page.waitForFunction(
        () => document.getElementById("solveResult").textContent.length > 0,
        null,
        { timeout: 60_000 },
      );

      const fieldValue = await page.evaluate(
        () =>
          document.querySelector("cap-widget input[name='my-custom-token']")
            .value,
      );
      expect(fieldValue.length).toBeGreaterThan(0);
      await page.close();
    }, 90_000);

    test("regression: reset clears the token", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/hiddenfield`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );
      await page.evaluate(() => document.getElementById("cap").solve());
      await page.waitForFunction(
        () => document.getElementById("solveResult").textContent.length > 0,
        null,
        { timeout: 60_000 },
      );

      const tokenBefore = await page.evaluate(
        () => document.getElementById("cap").token,
      );
      expect(tokenBefore).toBeTruthy();

      await page.evaluate(() => document.getElementById("cap").reset());
      const tokenAfter = await page.evaluate(
        () => document.getElementById("cap").token,
      );
      expect(tokenAfter).toBeFalsy();
      await page.close();
    }, 90_000);

    test("regression: unmount + remount during the verify wait leaves one usable trigger", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/page/remount`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__remountDuringSolve());

      // the stale solve must settle instead of hanging on to the widget
      expect(res.staleSettled.settled).toBe(true);
      expect(res.staleSettled.value).toBeFalsy();

      // the re-attached widget rebuilds a single, interactive UI
      expect(res.mid.triggers).toBe(1);
      expect(res.mid.children).toEqual([
        "captcha-trigger",
        "cap-troubleshoot-link",
        "credits",
      ]);
      expect(res.mid.state).not.toBe("verifying");
      expect(res.mid.label).not.toBe("Verifying...");
      expect(res.mid.disabled).toBe(false);

      // clicking it after the remount still verifies
      expect(res.gotToken).toBe(true);
      expect(res.final.triggers).toBe(1);
      expect(res.final.state).toBe("done");
      expect(res.final.token).toBeTruthy();
      expect(res.final.input).toBe(res.final.token);
      expect(errors).toEqual([]);
      await page.close();
    }, 60_000);

    test("regression: reset during solve starts a fresh solve and drops the stale one", async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/page/reset-solve`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__resetThenSolve());

      // the button is usable again immediately after reset()
      expect(res.afterReset.disabled).toBe(false);
      expect(res.afterReset.token).toBeFalsy();

      // the new solve runs and wins
      expect(res.secondResult.settled).toBe(true);
      expect(res.secondResult.value?.success).toBe(true);
      expect(res.final.token).toBeTruthy();
      expect(res.final.state).toBe("done");

      // the stale solve must not commit its token or dispatch a late solve
      expect(res.firstResult.settled).toBe(true);
      expect(res.firstResult.value).toBeFalsy();
      expect(res.events.length).toBe(1);
      expect(res.events[0].token).toBe(res.final.token);
      expect(errors).toEqual([]);
      await page.close();
    }, 60_000);

    test("regression: remount while a speculative solve is in flight does not deadlock", async () => {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`${baseUrl}/page/speculative-remount`, {
        waitUntil: "load",
      });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__speculativeRemount());

      // the stale solve must be released (it used to hang forever on the
      // discarded speculative state, leaving #solving true and the button dead)
      expect(res.staleResult.settled).toBe(true);
      expect(res.staleResult.value).toBeFalsy();

      expect(res.mid.triggers).toBe(1);
      expect(res.mid.state).not.toBe("verifying");
      expect(res.mid.disabled).toBe(false);

      expect(res.gotToken).toBe(true);
      expect(res.token).toBeTruthy();
      expect(res.state).toBe("done");
      expect(res.errors).toEqual([]);
      expect(pageErrors).toEqual([]);
      await page.close();
    }, 60_000);

    // Shared assertions for the three "speculative token expired" cases: the
    // widget must abandon the spent challenge+solutions, fetch a new challenge,
    // redeem it and finish on a brand-new token with the done UI — without ever
    // tripping the mock's nonce consumption.
    const expectFreshChallengeAfterExpiry = (res) => {
      expect(res.sawToken).toBe(true);
      expect(res.rejected).toBeNull();
      expect(res.result?.success).toBe(true);
      expect(res.errors).toEqual([]);

      // the spent state was dropped in place: no public reset() event and no
      // UI flash back to the empty state on the way to done
      expect(res.resets).toBe(0);
      expect(res.states).toEqual(["verifying", "done"]);

      expect(res.log.challenges).toBe(2);
      expect(res.log.redeems).toBe(2);
      expect(res.log.alreadyRedeemed).toBe(0);
      expect(res.log.tokens.length).toBe(2);
      expect(res.ui.state).toBe("done");
      expect(res.ui.token).toBe(res.log.tokens[1]);
      expect(res.ui.token).not.toBe(res.log.tokens[0]);
      expect(res.ui.input).toBe(res.ui.token);
      expect(res.ms).toBeGreaterThanOrEqual(1000);
    };

    const progressMarks = (res) =>
      res.events.progress
        .filter((p) => p.t >= res.t0)
        .map((p) => ({ progress: p.progress, t: Math.round(p.t - res.t0) }));

    const progressHundreds = (res) =>
      progressMarks(res).filter((m) => m.progress === 100);

    test("regression: already-expired speculative token at solve() entry refetches the challenge (F4/G2)", async () => {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`${baseUrl}/page/expiry`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__expiryCase("idle"));

      expectFreshChallengeAfterExpiry(res);
      expect(pageErrors).toEqual([]);
      // the spent token was dropped before any commit wait: the only
      // progress:100 is the one from the fresh cold-path redeem
      expect(progressHundreds(res).length).toBe(1);
      await page.close();
    }, 60_000);

    test("regression: speculative token expiring inside the verify wait refetches the challenge (F4/G1 path 1)", async () => {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`${baseUrl}/page/expiry`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__expiryCase("wait"));

      expectFreshChallengeAfterExpiry(res);
      expect(pageErrors).toEqual([]);
      const hundreds = progressHundreds(res);
      expect(hundreds.length).toBe(2);
      // the cached token was still valid at solve() entry, so the widget went
      // straight into the minimum-display wait before the skew expired it
      expect(hundreds[0].t).toBeLessThanOrEqual(250);
      await page.close();
    }, 60_000);

    test("regression: speculative token expiring after onSettled refetches the challenge (F4/G1 path 2)", async () => {
      const page = await browser.newPage();
      const pageErrors = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      await page.goto(`${baseUrl}/page/expiry`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const res = await page.evaluate(() => window.__expiryCase("settle"));

      expectFreshChallengeAfterExpiry(res);
      expect(pageErrors).toEqual([]);
      const hundreds = progressHundreds(res);
      expect(hundreds.length).toBe(2);
      // solve() entered while the speculative redeem was still in flight, so
      // the "token is valid" moment (and the skew) lands well after entry
      expect(hundreds[0].t).toBeGreaterThanOrEqual(250);
      await page.close();
    }, 60_000);

    test("regression: success path keeps the verifying UI for at least 1000ms", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/hiddenfield`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const timing = await page.evaluate(async () => {
        const w = document.getElementById("cap");
        let progress0At = null;
        let solvedAt = null;
        w.addEventListener("progress", (e) => {
          if (e.detail.progress === 0 && progress0At === null) {
            progress0At = performance.now();
          }
        });
        w.addEventListener("solve", () => {
          solvedAt = performance.now();
        });
        const t0 = performance.now();
        const result = await w.solve();
        return {
          ms: performance.now() - t0,
          success: !!result?.success,
          labelMs: solvedAt - progress0At,
        };
      });

      expect(timing.success).toBe(true);
      expect(timing.ms).toBeGreaterThanOrEqual(1000);
      // F5: the clock starts once the "Verifying..." UI has been applied, so
      // the observable label window — progress:0 is dispatched right after the
      // label/aria update — must hold the animation for >= 1000ms too.
      expect(timing.labelMs).toBeGreaterThanOrEqual(1000);
      await page.close();
    }, 60_000);
  });
}
