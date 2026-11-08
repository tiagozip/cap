import { afterAll, beforeAll, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

if (process.env.SKIP_E2E || !chromium) {
  test.skip("csp e2e skipped", () => {});
} else {
  const { makeBaseHandler } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "csp-e2e-secret-32-bytes-padding-abcdef!";
  const NONCE = "c2NyaXB0bm9uY2U";
  const CSP = `script-src 'nonce-${NONCE}' 'wasm-unsafe-eval'; worker-src blob:`;
  let opts = {};
  let results = [];
  let server;
  let browser;
  let baseUrl;

  const page = (withNonce) => `<!doctype html><html><head>
<script nonce="${NONCE}">window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";${withNonce ? `window.CAP_SCRIPT_NONCE = "${NONCE}";` : ""}</script>
</head><body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
<div id="ok"></div><div id="err"></div><div id="code"></div>
<script nonce="${NONCE}" src="/widget.js"></script>
<script nonce="${NONCE}">
const w = document.getElementById("cap");
w.addEventListener("solve", (e) => { document.getElementById("ok").textContent = e.detail.token; });
w.addEventListener("error", (e) => {
  document.getElementById("err").textContent = e.detail.message || "error";
  document.getElementById("code").textContent = e.detail.code || "";
});
</script></body></html>`;

  beforeAll(() => {
    const base = makeBaseHandler({
      onChallenge: () =>
        generateChallenge(SECRET, {
          challengeCount: 2,
          challengeSize: 16,
          challengeDifficulty: 1,
          ...opts,
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
        if (pathname === "/strict" || pathname === "/nononce") {
          return new Response(page(pathname === "/strict"), {
            headers: {
              "Content-Type": "text/html",
              "Content-Security-Policy": CSP,
            },
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

  const run = async (path) => {
    results = [];
    browser = await chromium.launch({ headless: true });
    try {
      const p = await browser.newPage();
      const logs = [];
      p.on("console", (m) => logs.push(m.text()));
      await p.goto(`${baseUrl}${path}`);
      await p.waitForFunction(() =>
        document
          .getElementById("cap")
          ?.shadowRoot?.querySelector(".captcha-trigger"),
      );
      const t0 = Date.now();
      const settled = await p.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .then(
            (r) => ({ resolved: r ?? null }),
            (e) => ({ rejected: { code: e.code, error: e instanceof Error } }),
          ),
      );
      await p.waitForFunction(
        () =>
          document.getElementById("ok").textContent ||
          document.getElementById("err").textContent,
        null,
        { timeout: 15_000 },
      );
      await p.waitForTimeout(200);
      return {
        ok: await p.textContent("#ok"),
        err: await p.textContent("#err"),
        code: await p.textContent("#code"),
        label: await p.evaluate(
          () =>
            document
              .getElementById("cap")
              .shadowRoot.querySelector(".label.active")?.textContent ?? "",
        ),
        logs,
        settled,
        ms: Date.now() - t0,
      };
    } finally {
      await browser.close();
      browser = null;
    }
  };

  for (const level of [5, 9]) {
    test(`a strict CSP with a nonce solves and records csp_eval_blocked at level ${level}`, async () => {
      opts = {
        instrumentation: {
          obfuscationLevel: level,
          detectAutomatedInteractions: true,
        },
      };
      const out = await run("/strict");
      expect(out.err).toBe("");
      expect(out.ok.length).toBeGreaterThan(0);
      expect(results).toHaveLength(1);
      expect(results[0].riskFlags).toContain("csp_eval_blocked");
      expect(results[0].riskFlags).not.toContain("legacy_widget");
    }, 25_000);
  }

  test("a CSP without the nonce fails fast with instr_csp_blocked", async () => {
    opts = { instrumentation: { obfuscationLevel: 1 } };
    const out = await run("/nononce");
    expect(out.ok).toBe("");
    expect(out.code).toBe("instr_csp_blocked");
    expect(out.settled).toEqual({
      rejected: { code: "instr_csp_blocked", error: true },
    });
    expect(out.ms).toBeLessThan(5_000);
    expect(out.label).toBe("Blocked by this page");
    expect(
      out.logs.some(
        (l) =>
          l.includes("Content-Security-Policy") &&
          l.includes("CAP_SCRIPT_NONCE") &&
          l.includes("#content-security-policy"),
      ),
    ).toBe(true);
    expect(results.at(-1)?.reason).toBe("instr_csp_blocked");
  }, 25_000);

  test("a format 2 challenge without the nonce reports instr_csp_blocked", async () => {
    opts = {
      format: 2,
      protocols: ["sha256-pow", "instrumentation"],
      instrumentation: { obfuscationLevel: 1 },
    };
    const out = await run("/nononce");
    expect(out.ok).toBe("");
    expect(out.code).toBe("instr_csp_blocked");
    expect(out.ms).toBeLessThan(5_000);
    expect(results.at(-1)?.reason).toBe("instr_csp_blocked");
  }, 25_000);
}
