import { afterAll, beforeAll, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

if (process.env.SKIP_E2E || !chromium) {
  test.skip("speculative e2e skipped", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "speculative-e2e-secret-32-bytes-padding!";
  const used = new Set();
  let redeems = [];
  let challenges = 0;
  let reject = false;
  let slow = false;
  let server;
  let browser;
  let baseUrl;

  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: makeBaseHandler({
        html: setLocalWasmHtml(`<!doctype html><html><head></head><body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
<div id="ok"></div><div id="err"></div>
<script src="/widget.js"></script>
<script>
const w = document.getElementById("cap");
w.addEventListener("solve", (e) => { document.getElementById("ok").textContent = e.detail.token; });
w.addEventListener("error", (e) => { document.getElementById("err").textContent = e.detail.message || "error"; });
</script></body></html>`),
        onChallenge: async () => {
          challenges++;
          return generateChallenge(SECRET, {
            challengeCount: slow ? 40 : 2,
            challengeSize: 16,
            challengeDifficulty: slow ? 4 : 1,
            instrumentation: { obfuscationLevel: 1 },
          });
        },
        onRedeem: async (body) => {
          const result = await validateChallenge(SECRET, body, {
            consumeNonce: (sig) => {
              if (used.has(sig)) return false;
              used.add(sig);
              return true;
            },
          });
          const failed = !result.success
            ? result.reason
            : reject
              ? "blocked_by_rule"
              : null;
          redeems.push({ token: body.token, failed });
          if (failed) {
            return Response.json(
              {
                success: false,
                error:
                  failed === "already_redeemed"
                    ? "Challenge already redeemed"
                    : "Blocked by a site rule",
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
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    server?.stop(true);
  });

  test("a speculative redeem the server refused shows the server's error", async () => {
    reject = true;
    redeems = [];
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl);
      await page.mouse.move(10, 10);
      await page.mouse.move(40, 30);
      const until = Date.now() + 12_000;
      while (!redeems.length && Date.now() < until) await Bun.sleep(100);
      expect(redeems.length).toBe(1);
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => {}),
      );
      await page.waitForFunction(
        () => document.getElementById("err").textContent,
        null,
        { timeout: 10_000 },
      );
      expect(await page.textContent("#err")).toBe("Blocked by a site rule");
      expect(redeems.length).toBe(1);
    } finally {
      reject = false;
      await page.close();
    }
  }, 25_000);

  test("a reset during a speculative solve leaves the new state clean", async () => {
    slow = true;
    redeems = [];
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl);
      await page.mouse.move(10, 10);
      await page.mouse.move(40, 30);
      await Bun.sleep(3_000);
      const before = challenges;
      await page.evaluate(() => document.getElementById("cap").reset());
      slow = false;
      await page.evaluate(() => document.getElementById("cap").solve());
      await page.waitForFunction(
        () =>
          document.getElementById("ok").textContent ||
          document.getElementById("err").textContent,
        null,
        { timeout: 15_000 },
      );
      expect(await page.textContent("#err")).toBe("");
      expect(challenges).toBeGreaterThan(before);
      const tokens = new Set(redeems.map((r) => r.token));
      expect(tokens.size).toBe(redeems.length);
      expect(redeems.every((r) => !r.failed)).toBe(true);
    } finally {
      slow = false;
      await page.close();
    }
  }, 25_000);

  test("refreshes skip hidden tabs and stop without interaction", async () => {
    const page = await browser.newPage();
    try {
      await page.clock.install();
      const start = challenges;
      await page.goto(baseUrl);
      const settle = async (n) => {
        const until = Date.now() + 5_000;
        while (challenges < n && Date.now() < until) await Bun.sleep(50);
        await Bun.sleep(150);
        return challenges;
      };
      expect(await settle(start + 1)).toBe(start + 1);
      const tick = 520_000;
      await page.evaluate(() =>
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        }),
      );
      await page.clock.fastForward(tick);
      expect(await settle(start + 2)).toBe(start + 1);
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(await settle(start + 2)).toBe(start + 2);
      for (let i = 0; i < 6; i++) {
        await page.clock.fastForward(tick);
        expect(await settle(start + 3 + i)).toBe(start + 3 + i);
      }
      await page.clock.fastForward(tick);
      expect(await settle(start + 9)).toBe(start + 8);
      await page.mouse.move(10, 10);
      expect(await settle(start + 9)).toBe(start + 9);
    } finally {
      await page.close();
    }
  }, 25_000);
}
