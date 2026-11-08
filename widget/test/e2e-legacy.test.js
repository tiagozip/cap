import { afterAll, beforeAll, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

if (process.env.SKIP_E2E || !chromium) {
  test.skip("legacy widget e2e skipped", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const oldWidget = fs.readFileSync(
    path.join(import.meta.dir, "legacy", "cap-0.1.58.min.js"),
    "utf-8",
  );
  const SECRET = "legacy-e2e-secret-32-bytes-padding-xyz!";
  let opts = {};
  let results = [];
  let server;
  let browser;
  let baseUrl;

  const page = (src) =>
    setLocalWasmHtml(`<!doctype html><html><head></head><body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
<div id="ok"></div><div id="err"></div>
<script src="${src}"></script>
<script>
const w = document.getElementById("cap");
w.addEventListener("solve", (e) => { document.getElementById("ok").textContent = e.detail.token; });
w.addEventListener("error", (e) => { document.getElementById("err").textContent = e.detail.message || "error"; });
</script></body></html>`);

  beforeAll(async () => {
    const base = makeBaseHandler({
      html: page("/old.js"),
      onChallenge: () =>
        generateChallenge(SECRET, {
          challengeCount: 2,
          challengeSize: 16,
          challengeDifficulty: 1,
          ...opts,
          instrumentation: { obfuscationLevel: 1, ...opts.instrumentation },
        }),
      onRedeem: async (body) => {
        const r = await validateChallenge(SECRET, body);
        results.push(r);
        return Response.json(
          r.success
            ? { success: true, token: r.token, expires: r.expires }
            : { success: false, error: r.reason },
          { status: r.success ? 200 : 403 },
        );
      },
    });
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (req) => {
        const { pathname } = new URL(req.url);
        if (pathname === "/old.js") {
          return new Response(oldWidget, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
        if (pathname === "/new") {
          return new Response(page("/widget.js"), {
            headers: { "Content-Type": "text/html" },
          });
        }
        return base(req);
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  const run = async (url, act) => {
    results = [];
    browser = await chromium.launch({ headless: true });
    try {
      const p = await browser.newPage();
      await p.goto(url);
      await p.waitForFunction(() =>
        document
          .getElementById("cap")
          ?.shadowRoot?.querySelector(".captcha-trigger"),
      );
      const t0 = Date.now();
      await act(p);
      await p.waitForFunction(
        () =>
          document.getElementById("ok").textContent ||
          document.getElementById("err").textContent,
        null,
        { timeout: 15_000 },
      );
      return {
        ok: await p.textContent("#ok"),
        err: await p.textContent("#err"),
        ms: Date.now() - t0,
      };
    } finally {
      await browser.close();
      browser = null;
    }
  };
  const solve = (p) =>
    p.evaluate(() =>
      document
        .getElementById("cap")
        .solve()
        .catch(() => {}),
    );

  test("0.1.58 solves on a key with default settings", async () => {
    opts = {};
    const out = await run(baseUrl, solve);
    expect(out.err).toBe("");
    expect(out.ok.length).toBeGreaterThan(0);
    expect(results.at(-1).success).toBe(true);
  }, 25_000);

  test("0.1.58 fails with instr_widget_outdated when a key blocks automated interactions", async () => {
    opts = { instrumentation: { blockAutomatedInteractions: true } };
    const out = await run(baseUrl, solve);
    expect(out.ok).toBe("");
    expect(out.ms).toBeLessThan(10_000);
    expect(results.at(-1).reason).toBe("instr_widget_outdated");
  }, 25_000);

  test("0.1.58 speculative solve redeems the early result", async () => {
    opts = { instrumentation: { detectAutomatedInteractions: true } };
    const out = await run(baseUrl, async (p) => {
      await p.mouse.move(20, 20);
      await p.mouse.move(60, 40);
      await p.waitForFunction(
        () =>
          performance.getEntriesByName(`${location.origin}/cap/redeem`).length >
          0,
        null,
        { timeout: 10_000 },
      );
      await p.click("#cap");
    });
    expect(out.err).toBe("");
    expect(out.ok.length).toBeGreaterThan(0);
    expect(results).toHaveLength(1);
    expect(results[0].riskFlags).toContain("legacy_widget");
  }, 25_000);

  test("0.1.58 solves a format 2 challenge", async () => {
    opts = {
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
      instrumentation: { detectAutomatedInteractions: true },
    };
    const out = await run(baseUrl, solve);
    expect(out.err).toBe("");
    expect(out.ok.length).toBeGreaterThan(0);
    expect(results.at(-1).riskFlags).toContain("legacy_widget");
  }, 25_000);

  test("the current widget ignores the early result", async () => {
    opts = { instrumentation: { blockAutomatedInteractions: true } };
    const out = await run(`${baseUrl}/new`, solve);
    expect(out.err).toBe("");
    expect(out.ok.length).toBeGreaterThan(0);
    expect(results.at(-1).riskFlags).not.toContain("legacy_widget");
  }, 25_000);
}
