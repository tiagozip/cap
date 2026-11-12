import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("wasm fallback e2e skipped", () => {});
} else {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { widgetMin, wasmBytes } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const dir = path.dirname(fileURLToPath(import.meta.url));
  const hashwxWasm = fs.readFileSync(
    path.join(dir, "..", "..", "core", "vendor", "hashwx.wasm"),
  );

  const SECRET = "wasm-fallback-e2e-secret-32-bytes-pad!!";
  const SCOPE = "fallback";

  let server;
  let browser;
  let baseUrl;
  const seen = [];
  let lastRedeem = null;

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
        if (url.pathname === "/cap_wasm_bg.wasm") {
          return new Response(wasmBytes, {
            headers: { "Content-Type": "application/wasm" },
          });
        }
        if (url.pathname === "/cap/challenge" && req.method === "POST") {
          const noWasm = url.searchParams.get("wasm") === "0";
          seen.push(noWasm ? "sha256-pow" : "hashwx");
          return Response.json(
            await generateChallenge(SECRET, {
              format: 2,
              protocols: noWasm
                ? ["sha256-pow", "instrumentation"]
                : ["hashwx", "instrumentation"],
              challengeCount: 8,
              challengeDifficulty: 3,
              hashwxDifficulty: 20_000,
              scope: SCOPE,
              instrumentation: noWasm ? { noWasm: true } : {},
            }),
          );
        }
        if (url.pathname === "/cap/redeem" && req.method === "POST") {
          const body = await req.json();
          lastRedeem = await validateChallenge(SECRET, body, { scope: SCOPE });
          if (!lastRedeem.success) {
            return Response.json(
              { success: false, error: lastRedeem.reason },
              { status: 403 },
            );
          }
          return Response.json({
            success: true,
            token: lastRedeem.token,
            expires: lastRedeem.expires,
          });
        }
        if (url.pathname === "/page") {
          return new Response(
            `<!DOCTYPE html><html><head>
<script>window.CAP_CUSTOM_HASHWX_URL = "/hashwx.wasm"; window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";</script>
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

  const run = async (initScript) => {
    seen.length = 0;
    lastRedeem = null;
    const context = await browser.newContext();
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    await page.goto(`${baseUrl}/page`, { waitUntil: "load" });
    const res = await page.evaluate(async () => {
      const w = document.getElementById("cap");
      try {
        const r = await Promise.race([
          w.solve(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("HUNG")), 30000),
          ),
        ]);
        return { ok: !!r?.success };
      } catch (err) {
        return { error: err.message };
      }
    });
    await context.close();
    return res;
  };

  describe("sha256 fallback without WebAssembly", () => {
    test("browsers with WebAssembly still get hashwx", async () => {
      const res = await run(null);
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      expect(seen.every((p) => p === "hashwx")).toBe(true);
      expect(lastRedeem.riskFlags).not.toContain("wasm_fallback");
    }, 60_000);

    test("a browser without WebAssembly solves sha256 and is flagged", async () => {
      const res = await run(() => {
        delete globalThis.WebAssembly;
      });
      expect(res.error).toBeUndefined();
      expect(res.ok).toBe(true);
      expect(seen).toContain("sha256-pow");
      expect(seen).not.toContain("hashwx");
      expect(lastRedeem.riskFlags).toContain("wasm_fallback");
    }, 60_000);

    test("a page that hides WebAssembly only from the widget fails", async () => {
      const res = await run(() => {
        if (window === window.top) delete globalThis.WebAssembly;
      });
      expect(res.ok).not.toBe(true);
      expect(seen).toContain("sha256-pow");
      expect(lastRedeem?.reason).toBe("instr_wasm_available");
    }, 60_000);
  });
}
