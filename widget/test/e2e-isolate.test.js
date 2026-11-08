import { afterAll, beforeAll, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

if (process.env.SKIP_E2E || !chromium) {
  test.skip("isolate e2e skipped", () => {});
} else {
  const { makeBaseHandler } = await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "isolate-e2e-secret-32-bytes-padding-abc!";
  const NONCE = "aXNvbGF0ZW5vbmNl";
  const CSP = `script-src 'nonce-${NONCE}' 'wasm-unsafe-eval'; worker-src blob:`;
  const EVIL = `try{parent.document.title="pwned"}catch(e){}`;
  let opts = {};
  let results = [];
  let server;
  let browser;
  let baseUrl;

  const page = ({
    isolate,
    endpoint,
  }) => `<!doctype html><html><head><title>victim</title>
<script nonce="${NONCE}">window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";window.CAP_SCRIPT_NONCE = "${NONCE}";${isolate ? "window.CAP_ISOLATE = true;" : ""}</script>
</head><body>
<cap-widget id="cap" data-cap-api-endpoint="${endpoint}"></cap-widget>
<div id="ok"></div><div id="code"></div>
<script nonce="${NONCE}" src="/widget.js"></script>
<script nonce="${NONCE}">
const w = document.getElementById("cap");
w.addEventListener("solve", (e) => { document.getElementById("ok").textContent = e.detail.token; });
w.addEventListener("error", (e) => { document.getElementById("code").textContent = e.detail.code || "error"; });
</script></body></html>`;

  const html = (body) =>
    new Response(body, {
      headers: { "Content-Type": "text/html", "Content-Security-Policy": CSP },
    });

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
      fetch: async (req) => {
        const { pathname } = new URL(req.url);
        if (pathname === "/isolated") {
          return html(page({ isolate: true, endpoint: "/cap/" }));
        }
        if (pathname === "/victim" || pathname === "/victim-isolated") {
          return html(
            page({
              isolate: pathname.endsWith("isolated"),
              endpoint: "/evil/",
            }),
          );
        }
        if (pathname === "/evil/challenge" && req.method === "POST") {
          const c = await generateChallenge(SECRET, {
            challengeCount: 1,
            challengeSize: 16,
            challengeDifficulty: 1,
            instrumentation: { obfuscationLevel: 1 },
          });
          c.instrumentation = deflateRawSync(Buffer.from(EVIL)).toString(
            "base64",
          );
          return Response.json(c);
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

  const open = async (path) => {
    browser = await chromium.launch({ headless: true });
    const p = await browser.newPage();
    await p.goto(`${baseUrl}${path}`);
    await p.waitForFunction(() =>
      document
        .getElementById("cap")
        ?.shadowRoot?.querySelector(".captcha-trigger"),
    );
    return p;
  };

  const until = async (p, fn, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await p.evaluate(fn)) return true;
      await p.waitForTimeout(100);
    }
    return false;
  };

  const close = async () => {
    await browser?.close();
    browser = null;
  };

  test("an isolated frame solves under a strict CSP and is flagged", async () => {
    results = [];
    opts = {
      instrumentation: {
        obfuscationLevel: 5,
        detectAutomatedInteractions: true,
      },
    };
    try {
      const p = await open("/isolated");
      const sandbox = p.evaluate(
        () =>
          new Promise((resolve) => {
            const look = () => {
              const f =
                document.querySelector("iframe[sandbox]") ||
                document
                  .getElementById("cap")
                  .shadowRoot.querySelector("iframe[sandbox]");
              if (f) return resolve(f.getAttribute("sandbox"));
              requestAnimationFrame(look);
            };
            look();
          }),
      );
      p.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => {}),
      ).catch(() => {});
      expect(await sandbox).toBe("allow-scripts");
      await until(
        p,
        () =>
          document.getElementById("ok").textContent ||
          document.getElementById("code").textContent,
        15_000,
      );
      expect(await p.textContent("#code")).toBe("");
      expect((await p.textContent("#ok")).length).toBeGreaterThan(0);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].riskFlags).toContain("isolated_frame");
      expect(results[0].riskFlags).not.toContain("legacy_widget");
    } finally {
      await close();
    }
  }, 25_000);

  test("an isolated frame fails on a key that enforces interaction checks", async () => {
    results = [];
    opts = {
      instrumentation: {
        obfuscationLevel: 1,
        blockAutomatedInteractions: true,
      },
    };
    try {
      const p = await open("/isolated");
      p.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => {}),
      ).catch(() => {});
      await until(
        p,
        () =>
          document.getElementById("ok").textContent ||
          document.getElementById("code").textContent,
        15_000,
      );
      expect(await p.textContent("#ok")).toBe("");
      expect(results.at(-1)?.reason).toBe("instr_isolated");
    } finally {
      await close();
    }
  }, 25_000);

  for (const [path, isolate] of [
    ["/victim", false],
    ["/victim-isolated", true],
  ]) {
    test(`an injected widget with a hostile endpoint ${isolate ? "can't" : "can"} reach the page`, async () => {
      try {
        const p = await open(path);
        p.evaluate(() =>
          document
            .getElementById("cap")
            .solve()
            .catch(() => {}),
        ).catch(() => {});
        await until(p, () => document.title === "pwned", 4_000);
        expect(await p.title()).toBe(isolate ? "victim" : "pwned");
      } finally {
        await close();
      }
    }, 25_000);
  }
}
