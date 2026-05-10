import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("worker e2e skipped", () => {});
} else {
  const { widgetMin, wasmBytes } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "worker-e2e-secret-32-bytes-padding-junk-!";

  let server;
  let browser;
  let baseUrl;

  beforeAll(async () => {
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
            challengeCount: 2,
            challengeSize: 8,
            challengeDifficulty: 1,
            scope: "worker",
          });
          return Response.json(r);
        }
        if (url.pathname === "/cap/redeem" && req.method === "POST") {
          const body = await req.json();
          const result = await validateChallenge(SECRET, body, {
            scope: "worker",
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
        const wasmInjection = `<script>window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";</script>`;
        if (url.pathname === "/page/multi") {
          return new Response(
            `<!DOCTYPE html><html><head>${wasmInjection}</head><body>
<cap-widget id="a" data-cap-api-endpoint="/cap/"></cap-widget>
<cap-widget id="b" data-cap-api-endpoint="/cap/"></cap-widget>
<div id="aRes"></div><div id="bRes"></div>
<script src="/widget.js"></script>
<script>
  document.getElementById("a").addEventListener("solve", (e) => { document.getElementById("aRes").textContent = e.detail.token; });
  document.getElementById("b").addEventListener("solve", (e) => { document.getElementById("bRes").textContent = e.detail.token; });
</script>
</body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
        }
        if (url.pathname === "/page/customcount") {
          return new Response(
            `<!DOCTYPE html><html><head>${wasmInjection}</head><body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-worker-count="1"></cap-widget>
<div id="solveResult"></div>
<script src="/widget.js"></script>
<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    document.getElementById("solveResult").textContent = e.detail.token;
  });
</script>
</body></html>`,
            { headers: { "Content-Type": "text/html" } },
          );
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

  describe("worker e2e", () => {
    test("multiple cap-widgets on the same page solve independently", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/multi`, { waitUntil: "load" });
      await page.waitForFunction(
        () =>
          document
            .getElementById("a")
            ?.shadowRoot?.querySelector?.(".captcha-trigger") &&
          document
            .getElementById("b")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );
      await page.evaluate(() => {
        document.getElementById("a").solve();
        document.getElementById("b").solve();
      });
      await page.waitForFunction(
        () =>
          document.getElementById("aRes").textContent.length > 0 &&
          document.getElementById("bRes").textContent.length > 0,
        null,
        { timeout: 60_000 },
      );
      const aTok = await page.evaluate(
        () => document.getElementById("aRes").textContent,
      );
      const bTok = await page.evaluate(
        () => document.getElementById("bRes").textContent,
      );
      expect(aTok).not.toBe(bTok);
      await page.close();
    }, 90_000);

    test("data-cap-worker-count=1 still solves", async () => {
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page/customcount`, { waitUntil: "load" });
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
      await page.close();
    }, 90_000);
  });
}
