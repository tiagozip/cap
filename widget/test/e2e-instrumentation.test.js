import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("instrumentation e2e skipped", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "instr-e2e-secret-32-bytes-padding-jjjjk!";

  let server;
  let browser;
  let page;
  let baseUrl;

  beforeAll(async () => {
    const html = setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>cap widget instr e2e</title></head>
<body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="cap-token"></cap-widget>
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
            challengeCount: 3,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "instr",
            instrumentation: {
              obfuscationLevel: 1,
              blockAutomatedBrowsers: false,
            },
          }),
        onRedeem: async (body) => {
          const result = await validateChallenge(SECRET, body, {
            scope: "instr",
          });
          if (!result.success) {
            return Response.json(
              {
                success: false,
                error: result.reason,
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
    page.on("pageerror", (err) =>
      console.error("[browser pageerror]", err.message),
    );
  }, 120_000);

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  describe("widget e2e with instrumentation", () => {
    test("instrumentation iframe runs and produces a token or documented error", async () => {
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
        () => {
          const solved = document.getElementById("solveResult").textContent;
          const error = document.getElementById("errorResult").textContent;
          return solved.length > 0 || error.length > 0;
        },
        null,
        { timeout: 60_000 },
      );

      const token = await page.evaluate(
        () => document.getElementById("solveResult").textContent,
      );
      const error = await page.evaluate(
        () => document.getElementById("errorResult").textContent,
      );

      const ok =
        (token && /^[a-z0-9]+:[a-f0-9]+$/.test(token)) || error.length > 0;
      expect(ok).toBe(true);
    }, 90_000);

    test("regression: forged cap:instr postMessage from parent window is ignored", async () => {
      const evilPage = await browser.newPage();
      evilPage.on("pageerror", (err) =>
        console.error("[browser pageerror]", err.message),
      );

      await evilPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await evilPage.waitForFunction(
        () =>
          document
            .getElementById("cap")
            ?.shadowRoot?.querySelector?.(".captcha-trigger"),
        null,
        { timeout: 10_000 },
      );

      await evilPage.evaluate(() => {
        // Burst-fire forged messages the moment any iframe is added to the
        // DOM — beats the legitimate sandboxed iframe's srcdoc script to
        // posting back, since those bursts are queued synchronously while
        // the real script still has to load + execute async.
        window.__capForgeObserver = new MutationObserver((muts) => {
          for (const m of muts) {
            for (const node of m.addedNodes) {
              if (node.tagName !== "IFRAME") continue;
              for (let i = 0; i < 200; i++) {
                window.postMessage(
                  {
                    type: "cap:instr",
                    blocked: true,
                    blockReason: "automated_browser",
                  },
                  "*",
                );
              }
            }
          }
        });
        window.__capForgeObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      });

      await evilPage.evaluate(() => document.getElementById("cap").solve());

      await evilPage.waitForFunction(
        () => {
          const solved = document.getElementById("solveResult").textContent;
          const error = document.getElementById("errorResult").textContent;
          return solved.length > 0 || error.length > 0;
        },
        null,
        { timeout: 60_000 },
      );

      await evilPage.evaluate(() => window.__capForgeObserver.disconnect());

      const token = await evilPage.evaluate(
        () => document.getElementById("solveResult").textContent,
      );
      const error = await evilPage.evaluate(
        () => document.getElementById("errorResult").textContent,
      );

      // Without the origin/source check, the forged blocked/error messages
      // would resolve runInstrumentationChallenge with __blocked or __timeout
      // long before the legitimate sandboxed iframe's script could respond,
      // which propagates to the widget's `error` handler.
      // With the fix, forged messages are dropped (ev.source mismatch) and
      // the legitimate flow completes — yielding a valid token.
      expect(error).toBe("");
      expect(token).toMatch(/^[a-z0-9]+:[a-f0-9]+$/);

      await evilPage.close();
    }, 90_000);
  });
}
