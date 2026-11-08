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
  const { generateInstrumentation, verifyInstrumentationResult } = await import(
    "../../core/src/instrumentation.js"
  );
  const { inflateRawSync } = await import("node:zlib");

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

      expect(error).toBe("");
      expect(token).toMatch(/^[a-z0-9]+:[a-f0-9]+$/);

      await evilPage.close();
    }, 90_000);
  });

  describe("observe phase", () => {
    test("an observing script holds its result until finalize", async () => {
      const meta = await generateInstrumentation({
        obfuscationLevel: 5,
        behavior: true,
        behaviorEnforced: true,
      });
      const src = inflateRawSync(
        Buffer.from(meta.instrumentation, "base64"),
      ).toString();
      const p = await browser.newPage();
      await p.goto(baseUrl, { waitUntil: "domcontentloaded" });
      const out = await p.evaluate(
        (script) =>
          new Promise((resolve) => {
            const iframe = document.createElement("iframe");
            iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
            const seen = [];
            let finalizedAt = 0;
            let early = null;
            window.addEventListener("message", (e) => {
              if (e.source !== iframe.contentWindow) return;
              if (e.data?.type === "cap:instr" && e.data.early === true) {
                early = { at: seen.length, result: e.data.result };
                return;
              }
              seen.push(e.data?.type);
              if (e.data?.type === "cap:ready") {
                setTimeout(() => {
                  finalizedAt = seen.length;
                  iframe.contentWindow.postMessage(
                    { type: "cap:finalize", nonce: "wrong" },
                    "*",
                  );
                  window.postMessage(
                    { type: "cap:finalize", nonce: e.data.nonce },
                    "*",
                  );
                  setTimeout(() => {
                    iframe.contentWindow.postMessage(
                      { type: "cap:finalize", nonce: e.data.nonce },
                      "*",
                    );
                  }, 300);
                }, 600);
              }
              if (e.data?.type === "cap:instr") {
                resolve({
                  seen,
                  finalizedAt,
                  early,
                  result: e.data.result,
                  ready: seen[0],
                });
              }
            });
            iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>${script}\n</scr${"ipt"}></body></html>`;
            document.body.appendChild(iframe);
            setTimeout(() => resolve({ seen, timeout: true }), 15_000);
          }),
        src,
      );
      await p.close();
      expect(out.timeout).toBeUndefined();
      expect(out.ready).toBe("cap:ready");
      expect(out.finalizedAt).toBe(1);
      expect(out.early?.at).toBe(1);
      expect(out.result).not.toEqual(out.early.result);
      expect(JSON.parse(out.early.result.d).bh).toBeNull();
      expect(verifyInstrumentationResult(meta, out.early.result)).toEqual({
        valid: false,
        reason: "instr_widget_outdated",
      });
      const verdict = verifyInstrumentationResult(meta, out.result);
      expect(verdict.valid).toBe(true);
      expect(verdict.trace).not.toBeNull();
      expect(verdict.riskFlags).not.toContain("legacy_widget");
    }, 30_000);
  });

  describe("realm tampering", () => {
    const run = async (meta, { hook = false, pre = "", userAgent } = {}) => {
      const src = inflateRawSync(
        Buffer.from(meta.instrumentation, "base64"),
      ).toString();
      const ctx = await browser.newContext(userAgent ? { userAgent } : {});
      const p = await ctx.newPage();
      await p.goto(baseUrl, { waitUntil: "domcontentloaded" });
      const out = await p.evaluate(
        ([script, hookIt, preScript]) =>
          new Promise((resolve) => {
            window.__stagehandV3__ = 1;
            const iframe = document.createElement("iframe");
            iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
            const swapped = [];
            window.addEventListener("message", (e) => {
              if (e.source !== iframe.contentWindow) return;
              const d = e.data;
              if (d?.type === "cap:instr" && d.early === true) return;
              if (d?.type === "cap:ready") {
                if (hookIt) {
                  const w = iframe.contentWindow;
                  const tries = [
                    () => {
                      w.JSON.stringify = () => "{}";
                    },
                    () => {
                      w.JSON = { stringify: () => "{}", parse: JSON.parse };
                    },
                    () => {
                      w.Object.keys = () => [];
                    },
                    () => {
                      w.Array.prototype.sort = () => [];
                    },
                    () => {
                      w.Array.prototype.slice = () => [];
                    },
                    () => {
                      w.String.prototype.charCodeAt = () => 0;
                    },
                    () => {
                      Object.defineProperty(w.Array.prototype, "indexOf", {
                        value: () => 0,
                      });
                    },
                  ];
                  for (const t of tries) {
                    try {
                      t();
                    } catch {}
                  }
                  swapped.push(
                    w.JSON.stringify({ a: 1 }) === '{"a":1}',
                    w.Object.keys({ a: 1 }).length === 1,
                    [2, 1].sort()[0] === 1,
                    "a".charCodeAt(0) === 97,
                  );
                }
                if (d.observe) {
                  iframe.contentWindow.postMessage(
                    { type: "cap:finalize", nonce: d.nonce },
                    "*",
                  );
                }
              }
              if (d?.type === "cap:instr" || d?.type === "cap:error") {
                resolve({ type: d.type, result: d.result, swapped });
              }
            });
            iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>${preScript}</scr${"ipt"}><script>${script}\n</scr${"ipt"}></body></html>`;
            document.body.appendChild(iframe);
            setTimeout(() => resolve({ type: "timeout" }), 15_000);
          }),
        [src, hook, pre],
      );
      await ctx.close();
      return out;
    };

    test("hooks set on the frame after it starts do not reach the result", async () => {
      for (const level of [3, 9]) {
        const meta = await generateInstrumentation({
          obfuscationLevel: level,
          behavior: true,
          detectAutomatedInteractions: true,
        });
        const out = await run(meta, { hook: true });
        expect(out.type).toBe("cap:instr");
        expect(out.swapped).toEqual([true, true, true, true]);
        const verdict = verifyInstrumentationResult(meta, out.result);
        expect(verdict.valid).toBe(true);
        expect(verdict.agent.all).toContain("stagehand");
      }
    }, 30_000);

    test("a frame whose natives were replaced before the script fails closed", async () => {
      const meta = await generateInstrumentation({ obfuscationLevel: 3 });
      for (const pre of [
        "Object.keys=function(o){return []}",
        "Array.prototype.sort=function(){return this}",
        "String.prototype.charCodeAt=function(){return 0}",
      ]) {
        const out = await run(meta, { pre });
        expect(out.type).toBe("cap:error");
      }
    }, 30_000);

    test("the frame serializer matches the server for awkward strings", async () => {
      const meta = await generateInstrumentation({ obfuscationLevel: 3 });
      const out = await run(meta, {
        userAgent:
          'Mozilla/5.0 "q" \\ \t \u00fc \u2028 \ud83d\ude00 \u0001 Chrome/120',
      });
      expect(out.type).toBe("cap:instr");
      const verdict = verifyInstrumentationResult(meta, out.result);
      expect(verdict.valid).toBe(true);
      expect(JSON.parse(out.result.d).hp.nav.ua).toContain("\ud83d\ude00");
    }, 30_000);
  });

  describe("obfuscation levels", () => {
    for (const level of [1, 5, 8, 9, 10]) {
      test(`level ${level} script posts a result the server accepts`, async () => {
        const meta = await generateInstrumentation({ obfuscationLevel: level });
        const src = inflateRawSync(
          Buffer.from(meta.instrumentation, "base64"),
        ).toString();
        const levelPage = await browser.newPage();
        await levelPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
        const result = await levelPage.evaluate(
          (script) =>
            new Promise((resolve) => {
              const iframe = document.createElement("iframe");
              iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
              const timer = setTimeout(() => resolve(null), 15_000);
              window.addEventListener("message", (e) => {
                if (e.source !== iframe.contentWindow) return;
                if (e.data?.type === "cap:ready" && e.data.observe) {
                  iframe.contentWindow.postMessage(
                    { type: "cap:finalize", nonce: e.data.nonce },
                    "*",
                  );
                }
                if (e.data?.type !== "cap:instr") return;
                clearTimeout(timer);
                resolve(e.data.result || null);
              });
              iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><script>${script}\n</scr${"ipt"}></body></html>`;
              document.body.appendChild(iframe);
            }),
          src,
        );
        await levelPage.close();
        expect(result).not.toBeNull();
        const verdict = verifyInstrumentationResult(meta, result);
        expect(verdict.valid).toBe(true);
        if (level < 10) expect(verdict.riskFlags).toContain("cdp_console_trap");
        expect(verdict.riskFlags).not.toContain("attach_shadow_patched");
        expect(verdict.riskFlags).toContain("automation_globals");
        expect(Object.keys(result).sort()).toEqual(["d", "i", "state"]);
        const bound = JSON.parse(result.d);
        expect(bound.ag).toContain("automation");
        expect(bound.vp).toEqual([1280, 720]);
      }, 30_000);
    }
  });
}
