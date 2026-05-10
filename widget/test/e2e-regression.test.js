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
  });
}
