import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("e2e tests skipped (set SKIP_E2E=0 and `bun add playwright`)", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "e2e-test-secret-32-bytes-padding-junk-1234";

  let server;
  let browser;
  let page;
  let baseUrl;
  const tokens = new Map();

  beforeAll(async () => {
    const html = setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>cap widget e2e</title>
</head>
<body>
<form id="testForm">
  <cap-widget
    id="cap"
    data-cap-api-endpoint="/cap/"
    data-cap-hidden-field-name="cap-token"
  ></cap-widget>
  <button type="submit">submit</button>
</form>
<div id="solveResult"></div>
<div id="errorResult"></div>
<script src="/widget.js"></script>
<script>
  const w = document.getElementById("cap");
  w.addEventListener("solve", (e) => {
    document.getElementById("solveResult").textContent = e.detail.token;
  });
  w.addEventListener("error", (e) => {
    document.getElementById("errorResult").textContent = e.detail.message || "error";
  });
</script>
</body>
</html>`);

    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: makeBaseHandler({
        html,
        onChallenge: async () =>
          await generateChallenge(SECRET, {
            challengeCount: 4,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "e2e",
          }),
        onRedeem: async (body) => {
          const result = await validateChallenge(SECRET, body, {
            scope: "e2e",
            consumeNonce: (sigHex) => {
              if (tokens.has(sigHex)) return false;
              tokens.set(sigHex, true);
              return true;
            },
          });
          if (!result.success) {
            return Response.json(
              {
                success: false,
                error: result.reason || "validation failed",
                ...(result.instr_error
                  ? { instr_error: true, reason: result.reason }
                  : {}),
              },
              { status: 403 },
            );
          }
          return Response.json({
            success: true,
            token: result.token,
            expires: result.expires,
          });
        },
      }),
    });
    baseUrl = `http://127.0.0.1:${server.port}`;

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 120_000);

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  describe("widget e2e", () => {
    test("renders the widget", async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      const exists = await page.evaluate(
        () => !!document.getElementById("cap"),
      );
      expect(exists).toBe(true);

      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      const triggerText = await page.evaluate(() => {
        const root = document.getElementById("cap").shadowRoot;
        return root.querySelector(".captcha-trigger")?.textContent || "";
      });
      expect(triggerText.length).toBeGreaterThan(0);
    }, 30_000);

    test("clicking solve runs PoW and dispatches solve event", async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
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

      const token = await page.evaluate(
        () => document.getElementById("solveResult").textContent,
      );
      expect(token).toMatch(/^[a-z0-9]+:[a-f0-9]+$/);

      const hiddenValue = await page.evaluate(() => {
        const w = document.getElementById("cap");
        return w.querySelector("input[name='cap-token']")?.value;
      });
      expect(hiddenValue).toBe(token);
    }, 90_000);

    test("speculative solve completes after interaction", async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      await page.mouse.move(100, 100);
      await page.mouse.move(200, 200);

      await page.evaluate(() => document.getElementById("cap").solve());
      await page.waitForFunction(
        () => document.getElementById("solveResult").textContent.length > 0,
        null,
        { timeout: 60_000 },
      );
    }, 90_000);

    test("widget exposes token via .token property after solve", async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
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
      const tokenViaProp = await page.evaluate(
        () => document.getElementById("cap").token,
      );
      expect(typeof tokenViaProp).toBe("string");
      expect(tokenViaProp.length).toBeGreaterThan(0);
    }, 90_000);
  });
}
