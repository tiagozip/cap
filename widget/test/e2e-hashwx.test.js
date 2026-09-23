import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("hashwx e2e skipped", () => {});
} else {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { widgetMin } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const dir = path.dirname(fileURLToPath(import.meta.url));
  const hashwxWasm = fs.readFileSync(
    path.join(dir, "..", "..", "core", "vendor", "hashwx.wasm"),
  );

  const SECRET = "hashwx-e2e-secret-32-bytes-padding-junk!";
  const DIFFICULTY = 20_000;

  let server;
  let browser;
  let baseUrl;
  let override = null;
  let challengeCount = 1;
  let difficulty = DIFFICULTY;

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
        if (url.pathname === "/hashwx.wasm") {
          return new Response(hashwxWasm, {
            headers: { "Content-Type": "application/wasm" },
          });
        }
        if (url.pathname === "/cap/challenge" && req.method === "POST") {
          const r = await generateChallenge(SECRET, {
            format: 2,
            protocols: ["hashwx"],
            hashwxDifficulty: difficulty,
            hashwxChallengeCount: challengeCount,
            scope: "hashwx",
          });
          if (override) Object.assign(r.challenges[0].payload, override);
          return Response.json(r);
        }
        if (url.pathname === "/cap/redeem" && req.method === "POST") {
          const body = await req.json();
          const result = await validateChallenge(SECRET, body, {
            scope: "hashwx",
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
        if (url.pathname === "/page") {
          return new Response(
            `<!DOCTYPE html><html><head>
<script>window.CAP_CUSTOM_HASHWX_URL = "/hashwx.wasm";</script>
</head><body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/widget.js"></script>
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

  const attempt = async (page) =>
    page.evaluate(async () => {
      const w = document.getElementById("cap");
      w.reset();
      await new Promise((r) => setTimeout(r, 40));
      const started = performance.now();
      try {
        const res = await Promise.race([
          w.solve(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("HUNG")), 20000),
          ),
        ]);
        return { ok: !!res?.success, ms: performance.now() - started };
      } catch (err) {
        return { error: err.message, ms: performance.now() - started };
      }
    });

  describe("hashwx e2e", () => {
    test("solves a hashwx challenge and redeems a token", async () => {
      override = null;
      challengeCount = 1;
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page`, { waitUntil: "load" });
      const res = await attempt(page);
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      await page.close();
    }, 60_000);

    test("solves several hashwx sub-challenges", async () => {
      override = null;
      challengeCount = 4;
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page`, { waitUntil: "load" });
      const res = await attempt(page);
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      await page.close();
      challengeCount = 1;
    }, 60_000);

    test("finishes when workers never acknowledge a stop", async () => {
      override = null;
      challengeCount = 4;
      difficulty = 400_000;
      const page = await browser.newPage();
      await page.addInitScript(() => {
        const Base = window.Worker;
        const wrapped = new WeakMap();
        window.Worker = class extends Base {
          addEventListener(type, fn, opts) {
            if (type !== "message") return super.addEventListener(type, fn, opts);
            const inner = (e) => {
              if (e.data?.found === false && e.data?.error === "stopped") return;
              fn(e);
            };
            wrapped.set(fn, inner);
            return super.addEventListener(type, inner, opts);
          }
          removeEventListener(type, fn, opts) {
            return super.removeEventListener(type, wrapped.get(fn) || fn, opts);
          }
        };
      });
      await page.goto(`${baseUrl}/page`, { waitUntil: "load" });
      const res = await attempt(page);
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      expect(res.ms).toBeGreaterThan(1000);
      await page.close();
      challengeCount = 1;
      difficulty = DIFFICULTY;
    }, 60_000);

    test("rejects malformed payloads instead of spinning", async () => {
      challengeCount = 1;
      const page = await browser.newPage();
      await page.goto(`${baseUrl}/page`, { waitUntil: "load" });

      for (const bad of [
        { n: 0 },
        { n: -1 },
        { n: 1.5 },
        { n: 2_000_000 },
        { d: 0 },
        { d: -5 },
        { c: "abcd" },
        { c: "z".repeat(64) },
      ]) {
        override = bad;
        const res = await attempt(page);
        expect(res.ok).toBeFalsy();
        expect(res.error).toBeDefined();
        expect(res.error).not.toBe("HUNG");
        expect(res.ms).toBeLessThan(5000);
      }

      override = null;
      const good = await attempt(page);
      expect(good.ok).toBe(true);
      await page.close();
    }, 120_000);
  });
}
