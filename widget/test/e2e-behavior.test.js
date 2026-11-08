import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("behavior e2e skipped", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "behavior-e2e-secret-32-bytes-padding!!";

  let server;
  let browser;
  let baseUrl;
  let policy = true;
  let format = 1;
  let last = null;
  const seen = new Set();

  const html = setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>cap behavior e2e</title>
<style>body{margin:0;height:1200px} #cap{position:absolute;left:420px;top:300px} #field{position:absolute;left:40px;top:40px}</style></head>
<body>
<input id="field" autocomplete="off">
<cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
<div id="solveResult"></div>
<div id="errorResult"></div>
<script src="/widget.js"></script>
<script>
  const w = document.getElementById("cap");
  w.addEventListener("solve", (e) => { document.getElementById("solveResult").textContent = e.detail.token; });
  w.addEventListener("error", (e) => { document.getElementById("errorResult").textContent = e.detail.message || "error"; });
</script>
</body>
</html>`);

  beforeAll(async () => {
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: makeBaseHandler({
        html,
        onChallenge: async () =>
          await generateChallenge(SECRET, {
            ...(format === 2 ? { format: 2, protocols: ["sha256-pow"] } : {}),
            challengeCount: 2,
            challengeSize: 16,
            challengeDifficulty: 1,
            behavior: policy,
            instrumentation: { obfuscationLevel: 1 },
          }),
        onRedeem: async (body) => {
          const result = await validateChallenge(SECRET, body, {
            behaviorReplayCheck: (digest) => {
              const dup = seen.has(digest);
              seen.add(digest);
              return dup;
            },
          });
          last = { body, result };
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
        },
      }),
    });
    baseUrl = `http://127.0.0.1:${server.port}`;
    browser = await chromium.launch({ headless: true });
  }, 120_000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  async function open(opts = {}, before) {
    last = null;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on("pageerror", (err) => console.error("[pageerror]", err.message));
    if (before) await before(page, ctx);
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document
          .getElementById("cap")
          ?.shadowRoot?.querySelector?.(".captcha-trigger"),
      null,
      { timeout: 10_000 },
    );
    const box = await page.evaluate(() => {
      const r = document
        .getElementById("cap")
        .shadowRoot.querySelector(".captcha-trigger")
        .getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    return { ctx, page, box };
  }

  const instrOf = (body) =>
    body.instr ?? body.solutions?.find?.((x) => x?.instr)?.instr;
  const boundOf = (body) => JSON.parse(instrOf(body).d);

  async function settle(page) {
    await page.waitForFunction(
      () =>
        document.getElementById("solveResult").textContent ||
        document.getElementById("errorResult").textContent,
      null,
      { timeout: 30_000 },
    );
    for (let i = 0; i < 50 && !last; i++) await Bun.sleep(20);
    return last;
  }

  async function humanishClick(page, box) {
    let x = 60;
    let y = 520;
    await page.mouse.move(x, y);
    const tx = box.x + box.w * 0.31;
    const ty = box.y + box.h * 0.62;
    const steps = 28;
    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      const e = 1 - (1 - p) ** 3;
      const bow = Math.sin(p * Math.PI) * 70;
      x = 60 + (tx - 60) * e + bow * 0.4 + (Math.random() - 0.5) * 2.5;
      y = 520 + (ty - 520) * e - bow + (Math.random() - 0.5) * 2.5;
      await page.mouse.move(x, y);
      await Bun.sleep(8 + Math.random() * 18);
    }
    await page.mouse.move(tx, ty);
    await Bun.sleep(120 + Math.random() * 80);
    await page.mouse.down();
    await Bun.sleep(70 + Math.random() * 40);
    await page.mouse.up();
  }

  describe("behavior e2e", () => {
    test("page.click() warps to the exact center with a 0ms press", async () => {
      policy = true;
      const { ctx, page } = await open();
      await Bun.sleep(300);
      await page.locator("cap-widget").locator(".captcha-trigger").click();
      const { result, body } = await settle(page);
      expect(body.behavior).toBeUndefined();
      expect(boundOf(body).bh.a.k).toBe(0);
      expect(result.success).toBe(true);
      expect(result.behavior.flags).toEqual(
        expect.arrayContaining([
          "bh_warp_click",
          "bh_instant_press",
          "bh_center_hit",
        ]),
      );
      expect(result.behavior.score).toBeLessThanOrEqual(0.6);
      expect(result.behavior.verdict).toBe("agent");
      expect(result.behavior.agent.name).toBe("cdp-automation");
      expect(result.riskFlags).toContain("bh_warp_click");
      expect(result.riskFlags).toContain("agent:cdp-automation");
      await ctx.close();
    }, 60_000);

    test("mouse.move with steps is flagged as an interpolated path", async () => {
      policy = { block: true };
      const { ctx, page, box } = await open();
      await page.mouse.move(40, 600);
      await page.mouse.move(box.x + box.w / 2 + 7, box.y + box.h / 2 + 3, {
        steps: 15,
      });
      await Bun.sleep(150);
      await page.mouse.down();
      await Bun.sleep(90);
      await page.mouse.up();
      const { result } = await settle(page);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("behavior_automated");
      expect(result.behavior.flags).toContain("bh_linear_path");
      await ctx.close();
    }, 60_000);

    test("element.click() from script is an untrusted activation", async () => {
      policy = { block: true };
      const { ctx, page } = await open();
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .shadowRoot.querySelector(".captcha-trigger")
          .click(),
      );
      const { result } = await settle(page);
      expect(result.success).toBe(false);
      expect(result.behavior.flags).toContain("bh_untrusted_activation");
      await ctx.close();
    }, 60_000);

    test("keyboard activation passes even with a robotic key press", async () => {
      policy = { block: true };
      const { ctx, page } = await open();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(
        () =>
          document.getElementById("cap").shadowRoot.activeElement?.className,
      );
      expect(focused).toContain("captcha-trigger");
      await Bun.sleep(200);
      await page.keyboard.press("Enter");
      const { result } = await settle(page);
      expect(result.behavior.signals.activation).toBe("key");
      expect(result.success).toBe(true);
      expect(result.behavior.verdict).not.toBe("automated");
      await ctx.close();
    }, 60_000);

    test("a humanlike pointer path is scored ok and passes block mode", async () => {
      policy = { block: true };
      for (const f of [1, 2]) {
        format = f;
        const { ctx, page, box } = await open();
        await Bun.sleep(400);
        await humanishClick(page, box);
        const { result } = await settle(page);
        expect(result.success).toBe(true);
        expect(result.behavior.verdict).toBe("ok");
        expect(result.behavior.flags).toEqual([]);
        expect(result.behavior.agent).toBeUndefined();
        await ctx.close();
      }
      format = 1;
    }, 90_000);

    test("fixed-delay keyboard.type() is flagged as metronome typing", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await page.click("#field");
      await page.keyboard.type("hello there friend", { delay: 45 });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.flags).toContain("bh_uniform_typing");
      expect(result.behavior.verdict).toBe("automated");
      await ctx.close();
    }, 60_000);

    test("programmatic solve() has no activation and is refused in block mode", async () => {
      policy = { block: true };
      const { ctx, page } = await open();
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => {}),
      );
      const { result } = await settle(page);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("behavior_no_interaction");
      await ctx.close();

      policy = true;
      const second = await open();
      await second.page.evaluate(() => document.getElementById("cap").solve());
      const r2 = await settle(second.page);
      expect(r2.result.success).toBe(true);
      expect(r2.result.behavior.verdict).toBe("no_interaction");
      await second.ctx.close();
    }, 60_000);

    test("a touch tap from CDP is not mistaken for a mouse warp", async () => {
      policy = true;
      const { ctx, page } = await open({ hasTouch: true });
      await Bun.sleep(300);
      await page.locator("cap-widget").locator(".captcha-trigger").tap();
      const { result } = await settle(page);
      expect(result.behavior.signals.pointerType).toBe("touch");
      expect(result.behavior.flags).not.toContain("bh_warp_click");
      expect(result.behavior.flags).toContain("bh_touch_geometry");
      await ctx.close();
    }, 60_000);

    test("a ghost-cursor style Bézier path is caught", async () => {
      policy = { block: true };
      const { ctx, page, box } = await open();
      const p0 = [70.3, 610.8];
      const p1 = [190.1, 280.4];
      const p2 = [box.x - 40.7, box.y + 230.2];
      const p3 = [box.x + box.w * 0.37, box.y + box.h * 0.58];
      const steps = 34;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        const pt = [0, 1].map(
          (k) =>
            u ** 3 * p0[k] +
            3 * u * u * t * p1[k] +
            3 * u * t * t * p2[k] +
            t ** 3 * p3[k],
        );
        await page.mouse.move(pt[0], pt[1]);
      }
      await Bun.sleep(130);
      await page.mouse.down();
      await Bun.sleep(85);
      await page.mouse.up();
      const { result } = await settle(page);
      expect(result.behavior.flags).toContain("bh_polynomial_path");
      expect(result.success).toBe(false);
      await ctx.close();
    }, 60_000);

    test("page.click() on a widget below the fold scrolls without input", async () => {
      policy = true;
      const { ctx, page } = await open();
      await page.evaluate(() => {
        document.body.style.height = "4000px";
        document.getElementById("cap").style.top = "2600px";
      });
      await Bun.sleep(1200);
      await page.locator("cap-widget").locator(".captcha-trigger").click();
      const { result } = await settle(page);
      expect(result.behavior.flags).toContain("bh_unexplained_scroll");
      expect(result.behavior.verdict).toBe("agent");
      await ctx.close();
    }, 60_000);

    test("a wheel scroll before clicking is not unexplained", async () => {
      policy = true;
      const { ctx, page } = await open();
      await page.evaluate(() => {
        document.body.style.height = "4000px";
        document.getElementById("cap").style.top = "1400px";
      });
      await Bun.sleep(1200);
      await page.mouse.move(300, 300);
      for (let i = 0; i < 10; i++) {
        await page.mouse.wheel(0, 120);
        await Bun.sleep(30);
      }
      await Bun.sleep(400);
      const box = await page.evaluate(() => {
        const r = document
          .getElementById("cap")
          .shadowRoot.querySelector(".captcha-trigger")
          .getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      });
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.flags).not.toContain("bh_unexplained_scroll");
      await ctx.close();
    }, 60_000);

    async function centerOf(page) {
      return page.evaluate(() => {
        const r = document
          .getElementById("cap")
          .shadowRoot.querySelector(".captcha-trigger")
          .getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    }

    test("browser-use click: exact center, 50ms, 80ms hold", async () => {
      policy = { blockAgents: "all" };
      const { ctx, page } = await open();
      await page.evaluate(() => {
        document.getElementById("cap").style.left = "421.5px";
      });
      await Bun.sleep(400);
      const c = await centerOf(page);
      await page.mouse.move(c.x, c.y);
      await Bun.sleep(50);
      await page.mouse.down();
      await Bun.sleep(80);
      await page.mouse.up();
      const { result } = await settle(page);
      expect(result.behavior.agent.name).toBe("browser-use");
      expect(result.behavior.agent.confidence).toBe("medium");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("behavior_agent");
      await ctx.close();
    }, 60_000);

    test("Claude in Chrome click: rounded coords, cursor wait, 12ms hold", async () => {
      policy = true;
      const { ctx, page } = await open();
      await Bun.sleep(400);
      const c = await centerOf(page);
      await page.mouse.move(Math.round(c.x - 37), Math.round(c.y + 9));
      await Bun.sleep(300);
      await page.mouse.down();
      await Bun.sleep(12);
      await page.mouse.up();
      const { result } = await settle(page);
      expect(result.behavior.verdict).toBe("agent");
      expect(result.behavior.agent.name).toBe("claude-in-chrome");
      await ctx.close();
    }, 60_000);

    test("Claude in Chrome overlay identifies the agent with high confidence", async () => {
      policy = { blockAgents: "identified" };
      const { ctx, page, box } = await open();
      await page.evaluate(() => {
        const d = document.createElement("div");
        d.id = "claude-agent-glow-border";
        d.style.display = "none";
        document.body.append(d);
      });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.agent).toMatchObject({
        name: "claude-in-chrome",
        confidence: "high",
      });
      expect(result.behavior.agent.evidence).toContain("artifact:cic_active");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("behavior_agent");
      await ctx.close();
    }, 60_000);

    test("browser-use highlight container identifies browser-use", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await Bun.sleep(300);
      await page.evaluate(() => {
        const d = document.createElement("div");
        d.id = "browser-use-debug-highlights";
        d.setAttribute("data-browser-use-highlight", "container");
        document.body.append(d);
        setTimeout(() => d.remove(), 100);
      });
      await Bun.sleep(400);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.agent.name).toBe("browser-use");
      expect(result.behavior.agent.confidence).toBe("high");
      await ctx.close();
    }, 60_000);

    const artifactCases = [
      [
        "cic_legacy",
        "claude-in-chrome",
        "medium",
        "#claude-agent-animation-styles",
      ],
      ["codex", "codex", "medium", "#codex-agent-overlay-root"],
      ["browserflow", "browserflow", "medium", ".browserflow-container"],
      ["thunderbit", "thunderbit", "medium", "#thunderbit-crx-side-bar"],
      ["fellou", "fellou", "medium", "window.__FELLOU_TAB_ID__"],
      ["stagehand", "stagehand", "high", "window.__stagehandV3__"],
      [
        "twocaptcha",
        "2captcha-solver",
        "medium",
        "window.registerCaptchaWidget",
      ],
      ["codex", "codex", "medium", "#codex-browser-sidebar-comments-root"],
      ["browser_use", "browser-use", "high", "#browser-use-demo-panel"],
      ["fellou", "fellou", "medium", "#eko-highlight-container"],
      ["stagehand", "stagehand", "high", "[data-stagehand-mask]"],
      [
        "comet",
        "perplexity-comet",
        "medium",
        "#pplx-agent-overlay-stop-button",
      ],
      ["genspark", "genspark", "medium", "navigator.genspark"],
      ["genspark", "genspark", "medium", "#genspark-float-bar"],
      ["sigma", "sigma", "medium", "window.__SIGMA__"],
      ["manus", "manus", "medium", "window.__manusOriginalPostMessage"],
      ["manus", "manus", "medium", "#manus-action-mask-host"],
      [
        "antigravity",
        "google-antigravity",
        "medium",
        "html[data-jetski-tab-id]",
      ],
      ["cursor", "cursor", "medium", "window.__cursorDialogConfig"],
      ["skyvern", "skyvern", "medium", "[data-skyvern-otp-box]"],
      ["skyvern", "skyvern", "medium", "window.GlobalSkyvernFrameIndex"],
    ];
    for (const [code, name, confidence, mark] of artifactCases) {
      test(`${mark} identifies ${name}`, async () => {
        policy = true;
        const { ctx, page, box } = await open();
        await page.evaluate((m) => {
          if (m.startsWith("window.")) {
            window[m.slice(7)] = 1;
            return;
          }
          if (m.startsWith("navigator.")) {
            Object.defineProperty(navigator, m.slice(10), { value: {} });
            return;
          }
          if (m.startsWith("html[")) {
            document.documentElement.setAttribute(m.slice(5, -1), "1");
            return;
          }
          const d = document.createElement("div");
          if (m[0] === "#") d.id = m.slice(1);
          else if (m[0] === "[") d.setAttribute(m.slice(1, -1), "1");
          else d.className = m.slice(1);
          document.body.append(d);
        }, mark);
        await Bun.sleep(300);
        await humanishClick(page, box);
        const { result } = await settle(page);
        expect(result.behavior.agent).toMatchObject({ name, confidence });
        expect(result.behavior.agent.evidence).toContain(`artifact:${code}`);
        await ctx.close();
      }, 60_000);
    }

    test("Perplexity Comet stylesheet is found by the CSS probe", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await page.evaluate(() => {
        const st = document.createElement("style");
        st.textContent =
          "#pplx-agent-0_0-overlay-stop-button{z-index:2147483647;min-height:32px}";
        document.head.append(st);
      });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.agent).toMatchObject({
        name: "perplexity-comet",
        confidence: "medium",
      });
      expect(result.behavior.agent.evidence).toContain("artifact:comet");
      expect(
        await page.evaluate(
          () => !document.getElementById("pplx-agent-0_0-overlay-stop-button"),
        ),
      ).toBe(true);
      await ctx.close();
    }, 60_000);

    test("a similar rule without both properties is not Comet", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await page.evaluate(() => {
        const st = document.createElement("style");
        st.textContent =
          "#pplx-agent-0_0-overlay-stop-button{z-index:2147483647}";
        document.head.append(st);
      });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.agent?.evidence ?? []).not.toContain(
        "artifact:comet",
      );
      await ctx.close();
    }, 60_000);

    async function tamperRedeem(page, edit) {
      await page.route("**/cap/redeem", (route) => {
        const body = JSON.parse(route.request().postData());
        edit(body);
        route.continue({ postData: JSON.stringify(body) });
      });
    }

    async function tamperChallenge(page, edit) {
      await page.route("**/cap/challenge", async (route) => {
        const res = await route.fetch();
        const body = await res.json();
        edit(body);
        await route.fulfill({ response: res, json: body });
      });
    }

    test("a hidden overlay is bound into the result and cannot be edited out", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await tamperRedeem(page, (body) => {
        const instr = instrOf(body);
        const d = JSON.parse(instr.d);
        expect(d.ag).toContain("cic_active");
        d.ag = d.ag.filter((c) => c !== "cic_active");
        instr.d = JSON.stringify(d);
      });
      await page.evaluate(() => {
        const d = document.createElement("div");
        d.id = "claude-agent-glow-border";
        d.style.display = "none";
        document.body.append(d);
      });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.success).toBe(false);
      expect(result.reason).toBe("failed_challenge");
      await ctx.close();
    }, 60_000);

    test("a page global is found by the script and a forged trace is ignored", async () => {
      policy = { blockAgents: "identified" };
      const { ctx, page } = await open({}, async (p, c) => {
        await c.addInitScript(() => {
          window.__stagehandV3__ = {};
        });
        await tamperRedeem(p, (body) => {
          body.behavior = { v: 1, ag: [], a: { k: 0, tr: 1 } };
        });
      });
      await Bun.sleep(300);
      await page.locator("cap-widget").locator(".captcha-trigger").click();
      const { result, body } = await settle(page);
      expect(boundOf(body).ag).toContain("stagehand");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("behavior_agent");
      expect(result.behavior.agent.name).toBe("stagehand");
      await ctx.close();
    }, 60_000);

    test("editing any bound field fails the challenge", async () => {
      policy = true;
      for (const field of ["bh", "vp", "hp", "ia", "el"]) {
        const { ctx, page, box } = await open();
        await tamperRedeem(page, (body) => {
          const instr = instrOf(body);
          const d = JSON.parse(instr.d);
          d[field] =
            field === "bh"
              ? { ...d.bh, a: { ...d.bh.a, tr: 1, k: 0 }, m: [] }
              : field === "vp"
                ? [1920, 1080]
                : field === "hp"
                  ? {}
                  : field === "ia"
                    ? [0, 0]
                    : d.el + 1;
          instr.d = JSON.stringify(d);
        });
        await Bun.sleep(300);
        await humanishClick(page, box);
        const { result } = await settle(page);
        expect(result.success).toBe(false);
        expect(result.reason).toBe("failed_challenge");
        await ctx.close();
      }
    }, 120_000);

    test("stripping the script from the challenge fails the redeem", async () => {
      policy = true;
      for (const f of [1, 2]) {
        format = f;
        const { ctx, page, box } = await open({}, (p) =>
          tamperChallenge(p, (body) => {
            delete body.instrumentation;
            delete body.behavior;
            if (body.challenges) {
              body.challenges = body.challenges.filter(
                (x) => x.protocol !== "instrumentation",
              );
            }
          }),
        );
        await Bun.sleep(300);
        await humanishClick(page, box);
        const { result } = await settle(page);
        expect(result.success).toBe(false);
        expect(["instr_missing", "invalid_solutions"]).toContain(result.reason);
        await ctx.close();
      }
      format = 1;
    }, 90_000);

    test("clearing the behavior flag in the challenge still sends a trace", async () => {
      policy = { block: true };
      const { ctx, page, box } = await open({}, (p) =>
        tamperChallenge(p, (body) => {
          body.behavior = false;
        }),
      );
      await Bun.sleep(400);
      await humanishClick(page, box);
      const { result, body } = await settle(page);
      expect(boundOf(body).bh).not.toBeNull();
      expect(result.success).toBe(true);
      expect(result.behavior.verdict).toBe("ok");
      await ctx.close();
    }, 60_000);

    test("agent-speed typing (10ms per key) is flagged", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await page.click("#field");
      await page.keyboard.type("Jane Doe Smith", { delay: 9 });
      await Bun.sleep(300);
      await humanishClick(page, box);
      const { result } = await settle(page);
      expect(result.behavior.agent.evidence).toContain("typing:superhuman");
      expect(result.behavior.verdict).not.toBe("ok");
      await ctx.close();
    }, 60_000);

    test("replaying a captured trace is detected", async () => {
      policy = true;
      const { ctx, page, box } = await open();
      await Bun.sleep(300);
      await humanishClick(page, box);
      const first = await settle(page);
      expect(first.result.behavior.flags).not.toContain("bh_replayed");

      const { boundPayload, solveChallengeFromPublic } = await import(
        "../../core/test/helpers.js"
      );
      const { generateInstrumentation } = await import(
        "../../core/src/instrumentation.js"
      );
      let meta;
      const challenge = await generateChallenge(SECRET, {
        challengeCount: 1,
        challengeSize: 8,
        challengeDifficulty: 1,
        behavior: true,
        instrumentationGenerator: async (o) => {
          meta = await generateInstrumentation(o);
          return meta;
        },
      });
      const solutions = await solveChallengeFromPublic(challenge);
      const replay = await validateChallenge(
        SECRET,
        {
          token: challenge.token,
          solutions,
          instr: boundPayload(meta, { bh: boundOf(first.body).bh }),
        },
        {
          behaviorReplayCheck: (d) => {
            const dup = seen.has(d);
            seen.add(d);
            return dup;
          },
        },
      );
      expect(replay.behavior.flags).toContain("bh_replayed");
      expect(replay.behavior.verdict).toBe("automated");
      await ctx.close();
    }, 60_000);

    test("removing the widget detaches the collector from the page", async () => {
      const { ctx, page } = await open();
      try {
        const cdp = await ctx.newCDPSession(page);
        const captured = async () => {
          const { result } = await cdp.send("Runtime.evaluate", {
            expression: "window",
          });
          const { listeners } = await cdp.send(
            "DOMDebugger.getEventListeners",
            { objectId: result.objectId },
          );
          const tool = new Set(
            listeners
              .filter((l) => l.type.startsWith("__playwright"))
              .map((l) => l.scriptId),
          );
          return listeners.filter((l) => l.useCapture && !tool.has(l.scriptId))
            .length;
        };
        const until = Date.now() + 8_000;
        while ((await captured()) === 0 && Date.now() < until) {
          await Bun.sleep(100);
        }
        expect(await captured()).toBeGreaterThan(0);
        await page.evaluate(() => document.getElementById("cap").remove());
        await Bun.sleep(200);
        expect(await captured()).toBe(0);
      } finally {
        await ctx.close();
      }
    }, 20_000);
  });
}
