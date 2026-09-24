import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";

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
  const { generateInstrumentation, verifyInstrumentationResult } = await import(
    "../../core/src/instrumentation.js"
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

  async function runInFrame({
    zoom = 1,
    revealAfter,
    css = "",
    level = 1,
  } = {}) {
    const challenge = await generateInstrumentation({
      obfuscationLevel: level,
      blockAutomatedBrowsers: false,
    });
    const script = inflateRawSync(
      Buffer.from(challenge.instrumentation, "base64"),
    ).toString("utf8");
    await page.goto(baseUrl);
    const result = await page.evaluate(
      ({ script, zoom, revealAfter, css }) =>
        new Promise((resolve) => {
          document.body.style.zoom = String(zoom);
          const iframe = document.createElement("iframe");
          iframe.setAttribute("sandbox", "allow-scripts");
          iframe.style.cssText =
            "position:absolute;width:1px;height:1px;top:-9999px;left:-9999px;border:none;opacity:0;pointer-events:none;";
          if (revealAfter !== undefined) iframe.style.display = "none";
          let revealTimer;
          const finish = (result) => {
            clearTimeout(timeout);
            clearTimeout(revealTimer);
            window.removeEventListener("message", handler);
            iframe.remove();
            resolve(result);
          };
          const handler = (event) => {
            if (
              event.source === iframe.contentWindow &&
              event.data?.type === "cap:instr"
            ) {
              finish(event.data.result);
            }
          };
          const timeout = setTimeout(() => finish(null), 2000);
          window.addEventListener("message", handler);
          iframe.addEventListener("load", () => {
            if (revealAfter >= 0) {
              revealTimer = setTimeout(() => {
                iframe.style.display = "block";
              }, revealAfter);
            }
          });
          iframe.srcdoc = `<!doctype html><html><head><style>${css}</style></head><body><script>${script}</script></body></html>`;
          document.body.appendChild(iframe);
        }),
      { script, zoom, revealAfter, css },
    );
    return verifyInstrumentationResult(challenge, result).valid;
  }

  describe("widget e2e with instrumentation", () => {
    test("instrumentation iframe produces a valid token", async () => {
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

      expect(error).toBe("");
      expect(token).toMatch(/^[a-z0-9]+:[a-f0-9]+$/);
    }, 90_000);

    test("regression: layout probe waits for the iframe to become rendered", async () => {
      expect(await runInFrame({ revealAfter: 50 })).toBe(true);
    });

    for (const zoom of [0.75, 0.9, 1, 1.1, 1.25, 1.5, 2]) {
      test(`regression: layout probe accepts page zoom ${zoom}`, async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          expect(await runInFrame({ zoom })).toBe(true);
        }
      }, 15_000);
    }

    for (const level of [3, 7]) {
      test(`regression: layout probe works at obfuscation level ${level}`, async () => {
        expect(await runInFrame({ zoom: 1.25, level })).toBe(true);
      }, 15_000);
    }

    test("layout probe still rejects unavailable or inconsistent geometry", async () => {
      expect(await runInFrame({ revealAfter: -1 })).toBe(false);
      expect(await runInFrame({ css: "div { transform: scale(0.5) }" })).toBe(
        false,
      );
    }, 10_000);

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
