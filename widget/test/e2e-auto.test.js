import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("e2e tests skipped (set SKIP_E2E=0 and `bun add playwright`)", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml } = await import(
    "./test-server.js"
  );
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "e2e-auto-test-secret-32-bytes-padding-junk-12";
  const TOKEN_RE = /^[a-z0-9]+:[a-f0-9]+$/;

  let server;
  let browser;
  let page;
  let baseUrl;
  const tokens = new Set();

  let challengeRequests = 0;
  let redeemRequests = 0;
  let failChallenges = false;
  let challengeDelayMs = 0;
  let inFlight = 0;
  let maxInFlight = 0;

  const resetCounters = () => {
    challengeRequests = 0;
    redeemRequests = 0;
    maxInFlight = 0;
  };

  beforeAll(async () => {
    const html = setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>cap widget auto e2e</title>
<style>
  body { margin: 0; font-family: sans-serif; }
  #stage { min-height: 120px; }
</style>
</head>
<body>
<div id="stage"></div>
<script src="/widget.js"></script>
</body>
</html>`);

    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: makeBaseHandler({
        html,
        floatingHtml: setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>cap widget floating e2e</title>
<style>
  body { margin: 0; font-family: sans-serif; }
</style>
</head>
<body>
<cap-widget id="cap" data-cap-api-endpoint="/cap/" data-cap-hidden-field-name="cap-token" data-cap-auto="load"></cap-widget>
<button id="floating-trigger" data-cap-floating="#cap" data-cap-floating-position="bottom">Trigger floating mode</button>
<script src="/widget.js"></script>
<script src="/floating.js"></script>
</body>
</html>`),
        onChallenge: async () => {
          challengeRequests++;
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          try {
            if (challengeDelayMs > 0) {
              await new Promise((resolve) =>
                setTimeout(resolve, challengeDelayMs),
              );
            }
            if (failChallenges) {
              return Response.json({ error: "simulated outage" });
            }
            return await generateChallenge(SECRET, {
              challengeCount: 4,
              challengeSize: 16,
              challengeDifficulty: 2,
              scope: "e2e-auto",
            });
          } finally {
            inFlight--;
          }
        },
        onRedeem: async (body) => {
          redeemRequests++;
          const result = await validateChallenge(SECRET, body, {
            scope: "e2e-auto",
            consumeNonce: (sigHex) => {
              if (tokens.has(sigHex)) return false;
              tokens.add(sigHex);
              return true;
            },
          });
          if (!result.success) {
            return Response.json(
              { success: false, error: result.reason || "validation failed" },
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
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });

    // Spy on navigator.vibrate so haptics assertions are observable.
    await page.addInitScript(() => {
      window.__vibrations = [];
      const spy = (pattern) => {
        window.__vibrations.push(pattern);
        return true;
      };
      try {
        Object.defineProperty(Navigator.prototype, "vibrate", {
          value: spy,
          configurable: true,
          writable: true,
        });
      } catch {
        try {
          navigator.vibrate = spy;
        } catch {}
      }
    });
  }, 120_000);

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  /**
   * Loads a fresh page and mounts one widget.
   * `attrs` are applied on top of the endpoint/hidden-field defaults, and
   * `outOfView` pushes the widget below the fold before it is connected.
   */
  const mountWidget = async ({ attrs = {}, outOfView = false } = {}) => {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!customElements.get("cap-widget"));
    await page.evaluate(
      ({ attrs, outOfView }) => {
        window.__solveEvents = [];
        window.__errorEvents = [];
        window.__progressEvents = [];

        const stage = document.getElementById("stage");
        if (outOfView) stage.style.paddingTop = "2500px";
        window.scrollTo(0, 0);

        const w = document.createElement("cap-widget");
        w.id = "cap";
        w.setAttribute("data-cap-api-endpoint", "/cap/");
        w.setAttribute("data-cap-hidden-field-name", "cap-token");
        for (const [name, value] of Object.entries(attrs)) {
          w.setAttribute(name, value);
        }
        w.addEventListener("solve", (e) =>
          window.__solveEvents.push(e.detail.token),
        );
        w.addEventListener("error", (e) =>
          window.__errorEvents.push(e.detail.message || "error"),
        );
        w.addEventListener("progress", (e) =>
          window.__progressEvents.push(e.detail.progress),
        );

        stage.appendChild(w);
      },
      { attrs, outOfView },
    );
  };

  const readState = () =>
    page.evaluate(() => ({
      solves: window.__solveEvents,
      errors: window.__errorEvents,
      hidden: document.querySelector("input[name='cap-token']")?.value ?? null,
      token: document.getElementById("cap").token,
      disabled: document
        .getElementById("cap")
        .shadowRoot.querySelector(".captcha-trigger")
        .hasAttribute("disabled"),
      state: document
        .getElementById("cap")
        .shadowRoot.querySelector(".captcha")
        .getAttribute("data-state"),
    }));

  const readAria = () =>
    page.evaluate(() => {
      const trigger = document
        .getElementById("cap")
        .shadowRoot.querySelector(".captcha-trigger");
      const active = trigger.querySelector(".label-wrapper .label.active");
      return {
        live: trigger.getAttribute("aria-live"),
        atomic: trigger.getAttribute("aria-atomic"),
        label: active ? active.textContent.trim() : "",
        ariaLabel: trigger.getAttribute("aria-label"),
      };
    });

  const waitForSolve = (count = 1) =>
    page.waitForFunction(
      (n) => window.__solveEvents.length >= n,
      count,
      { timeout: 60_000 },
    );

  describe("widget data-cap-auto e2e", () => {
    test("load mode solves without a click and fills the hidden field", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "load" } });

      await waitForSolve(1);

      const state = await readState();
      expect(state.solves[0]).toMatch(TOKEN_RE);
      expect(state.hidden).toBe(state.solves[0]);
      expect(state.token).toBe(state.solves[0]);
      expect(state.state).toBe("done");
      expect(challengeRequests).toBe(1);
      expect(redeemRequests).toBe(1);
    }, 90_000);

    test("visible mode waits for the viewport before solving", async () => {
      resetCounters();
      await mountWidget({
        attrs: { "data-cap-auto": "visible" },
        outOfView: true,
      });

      // Well past any scheduling delay: nothing may run off-screen.
      await page.waitForTimeout(1500);
      let state = await readState();
      expect(state.solves.length).toBe(0);
      expect(state.hidden).toBe("");
      expect(challengeRequests).toBe(0);

      await page.evaluate(() =>
        document.getElementById("cap").scrollIntoView({ block: "center" }),
      );
      await waitForSolve(1);

      state = await readState();
      expect(state.solves[0]).toMatch(TOKEN_RE);
      expect(state.hidden).toBe(state.solves[0]);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("an empty attribute behaves like visible", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "" }, outOfView: true });

      await page.waitForTimeout(1500);
      expect(challengeRequests).toBe(0);

      await page.evaluate(() =>
        document.getElementById("cap").scrollIntoView({ block: "center" }),
      );
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("an unknown value falls back to visible", async () => {
      resetCounters();
      await mountWidget({
        attrs: { "data-cap-auto": "nonsense" },
        outOfView: true,
      });

      await page.waitForTimeout(1500);
      expect(challengeRequests).toBe(0);

      await page.evaluate(() =>
        document.getElementById("cap").scrollIntoView({ block: "center" }),
      );
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("without the attribute the widget stays click-only", async () => {
      resetCounters();
      await mountWidget();

      await page.waitForTimeout(1500);
      let state = await readState();
      expect(state.solves.length).toBe(0);
      expect(challengeRequests).toBe(0);
      expect(state.disabled).toBe(false);

      // …and a click (here: the programmatic equivalent) still works.
      await page.evaluate(() => document.getElementById("cap").solve());
      await waitForSolve(1);

      state = await readState();
      expect(state.hidden).toBe(state.solves[0]);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("off and false disable auto mode", async () => {
      for (const value of ["off", "false"]) {
        resetCounters();
        await mountWidget({ attrs: { "data-cap-auto": value } });
        await page.waitForTimeout(1200);
        expect(challengeRequests).toBe(0);
        expect((await readState()).solves.length).toBe(0);
      }
    }, 90_000);

    test("auto mode solves exactly once even after user activity", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "load" } });
      await waitForSolve(1);

      // Nudge the speculative pre-solver: with auto mode on it must stay disarmed.
      await page.mouse.move(120, 120);
      await page.mouse.move(240, 240);
      await page.waitForTimeout(3500);

      const state = await readState();
      expect(state.solves.length).toBe(1);
      expect(challengeRequests).toBe(1);
      expect(redeemRequests).toBe(1);
    }, 90_000);

    test("auto mode does not vibrate, a real click still does", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "load" } });
      await waitForSolve(1);
      expect(await page.evaluate(() => window.__vibrations.length)).toBe(0);

      // Control: the spy itself works.
      resetCounters();
      await mountWidget();
      await page.evaluate(() => document.getElementById("cap").solve());
      await waitForSolve(1);
      expect(
        await page.evaluate(() => window.__vibrations.length),
      ).toBeGreaterThan(0);
    }, 90_000);

    test("announces progress and the result through the aria-live region", async () => {
      resetCounters();
      challengeDelayMs = 800;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__progressEvents.length > 0);

        const during = await readAria();
        expect(during.live).toBe("polite");
        expect(during.atomic).toBe("true");
        expect(during.label).toBe("Verifying...");
        expect(during.ariaLabel).toBe("Verifying you're a human, please wait");

        await waitForSolve(1);

        const after = await readAria();
        expect(after.live).toBe("polite");
        expect(after.atomic).toBe("true");
        expect(after.label).toBe("Success");
        expect(after.ariaLabel).toBe(
          "We have verified you're a human, you may now continue",
        );
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("re-solves after reset while still in the viewport", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "visible" } });
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);

      await page.evaluate(() => document.getElementById("cap").reset());
      await waitForSolve(2);

      const state = await readState();
      expect(state.hidden).toBe(state.solves[1]);
      expect(challengeRequests).toBe(2);
    }, 90_000);

    test("a reset while off-screen waits for the next viewport entry", async () => {
      resetCounters();
      await mountWidget({
        attrs: { "data-cap-auto": "visible" },
        outOfView: true,
      });
      await page.evaluate(() =>
        document.getElementById("cap").scrollIntoView({ block: "center" }),
      );
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);

      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.getElementById("cap").reset();
      });
      await page.waitForTimeout(1500);
      expect(challengeRequests).toBe(1);

      await page.evaluate(() =>
        document.getElementById("cap").scrollIntoView({ block: "center" }),
      );
      await waitForSolve(2);
      expect(challengeRequests).toBe(2);
    }, 90_000);

    test("a failure shows the error state and is not retried automatically", async () => {
      resetCounters();
      failChallenges = true;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__errorEvents.length > 0, null, {
          timeout: 30_000,
        });
        await page.waitForTimeout(2000);

        let state = await readState();
        expect(challengeRequests).toBe(1);
        expect(state.state).toBe("error");
        // back to clickable
        expect(state.disabled).toBe(false);
      } finally {
        failChallenges = false;
      }

      await page.evaluate(() => document.getElementById("cap").solve());
      await waitForSolve(1);
      expect(challengeRequests).toBe(2);
    }, 90_000);

    test("adding the attribute at runtime starts one solve, not several", async () => {
      resetCounters();
      await mountWidget();
      await page.waitForTimeout(500);
      expect(challengeRequests).toBe(0);

      await page.evaluate(() =>
        document.getElementById("cap").setAttribute("data-cap-auto", "load"),
      );
      await waitForSolve(1);
      await page.waitForTimeout(2000);

      const state = await readState();
      expect(state.solves.length).toBe(1);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("toggling the attribute off disarms auto mode again", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "load" } });
      await waitForSolve(1);

      await page.evaluate(() =>
        document.getElementById("cap").setAttribute("data-cap-auto", "off"),
      );
      await page.evaluate(() => document.getElementById("cap").reset());
      await page.waitForTimeout(1500);

      expect(challengeRequests).toBe(1);
      expect((await readState()).solves.length).toBe(1);
    }, 90_000);

    test("load mode keeps a hidden widget inert until it is shown", async () => {
      resetCounters();
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !!customElements.get("cap-widget"));
      await page.evaluate(() => {
        window.__solveEvents = [];
        const w = document.createElement("cap-widget");
        w.id = "cap";
        w.style.display = "none";
        w.setAttribute("data-cap-api-endpoint", "/cap/");
        w.setAttribute("data-cap-auto", "load");
        w.addEventListener("solve", (e) =>
          window.__solveEvents.push(e.detail.token),
        );
        document.getElementById("stage").appendChild(w);
      });

      // Covers the floating-mode shape: the widget sits at display:none until
      // the user asks for it, so it must not burn a challenge up front.
      await page.waitForTimeout(1500);
      expect(challengeRequests).toBe(0);
      expect(await page.evaluate(() => window.__solveEvents.length)).toBe(0);

      await page.evaluate(() => {
        document.getElementById("cap").style.display = "inline-block";
      });
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("programmatic widgets ignore data-cap-auto", async () => {
      resetCounters();
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !!customElements.get("cap-widget"));
      await page.evaluate(() => {
        window.__solveEvents = [];
        window.__cap = new Cap({
          apiEndpoint: "/cap/",
          "data-cap-auto": "load",
        });
        window.__cap.addEventListener("solve", (e) =>
          window.__solveEvents.push(e.detail.token),
        );
      });

      await page.waitForTimeout(1500);
      expect(challengeRequests).toBe(0);
      expect(await page.evaluate(() => window.__solveEvents.length)).toBe(0);
      expect(
        await page.evaluate(
          () => document.querySelector("cap-widget").style.display,
        ),
      ).toBe("none");

      // The JS API still solves on demand.
      await page.evaluate(() => window.__cap.solve());
      await waitForSolve(1);
      expect(challengeRequests).toBe(1);
    }, 90_000);

    test("floating mode ignores data-cap-auto entirely (M1)", async () => {
      resetCounters();
      await page.goto(`${baseUrl}/floating`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => !!customElements.get("cap-widget"));
      await page.evaluate(() => {
        window.__solveEvents = [];
        document
          .getElementById("cap")
          .addEventListener("solve", (e) =>
            window.__solveEvents.push(e.detail.token),
          );
      });

      // Load-mode auto solving would have fired long before this.
      await page.waitForTimeout(2500);
      expect(challengeRequests).toBe(0);
      expect(redeemRequests).toBe(0);
      expect(await page.evaluate(() => window.__solveEvents.length)).toBe(0);
      expect(
        await page.evaluate(() => document.getElementById("cap").style.display),
      ).toBe("none");

      // Only the real trigger click may start a solve, and only one.
      await page.click("#floating-trigger");
      await waitForSolve(1);
      await page.waitForTimeout(1000);

      expect(challengeRequests).toBe(1);
      expect(redeemRequests).toBe(1);
      expect(maxInFlight).toBe(1);
      expect(
        await page.getAttribute("#floating-trigger", "data-cap-token"),
      ).toMatch(TOKEN_RE);
    }, 90_000);

    test("turning auto off mid-solve never arms speculative pre-solving (M2)", async () => {
      resetCounters();
      challengeDelayMs = 4000;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__progressEvents.length > 0);

        await page.evaluate(() =>
          document.getElementById("cap").setAttribute("data-cap-auto", "off"),
        );
        // User activity is what arms the speculative pre-solver; it must stay
        // disarmed while the auto solve is still in flight.
        await page.mouse.move(120, 120);
        await page.mouse.move(240, 240);
        // Long enough for a speculative fetch (2.5s delay) to have fired.
        await page.waitForTimeout(3000);
        expect(challengeRequests).toBe(1);

        // A reset invalidates the in-flight solve: it never redeems or commits
        // a token, and the widget is back to a fresh click-only state (where
        // speculative pre-solving is allowed again).
        await page.evaluate(() => document.getElementById("cap").reset());
        // Let the stale challenge (4s) land.
        await page.waitForTimeout(3000);
        expect((await readState()).solves.length).toBe(0);

        challengeDelayMs = 0;
        await page.locator("#cap .captcha-trigger").click();
        await waitForSolve(1);
        await page.waitForTimeout(3000);

        const state = await readState();
        expect(state.solves.length).toBe(1);
        expect(challengeRequests).toBe(2);
        expect(redeemRequests).toBe(1);
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("a reset mid-solve defers the speculative re-arm until the stale request ends (F2)", async () => {
      resetCounters();
      challengeDelayMs = 4000;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__progressEvents.length > 0);
        // Wait until the delayed challenge really is on the wire.
        while (challengeRequests < 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        const requestAt = Date.now();

        await page.evaluate(() => {
          document.getElementById("cap").setAttribute("data-cap-auto", "off");
          document.getElementById("cap").reset();
        });

        // Activity *after* the reset. Before the fix, reset() cleared
        // #solving before re-arming speculation, so this immediately attached
        // the interaction listeners and asked for a second challenge while the
        // invalidated solve's request was still running.
        await page.mouse.move(120, 120);
        await page.mouse.move(240, 240);
        const armedAt = Date.now();

        // Sample past the 2.5s speculative delay (SPECULATIVE_DELAY_MS), still
        // inside the stale request's 4s window: no second challenge may show
        // up, and the two requests must never overlap.
        while (Date.now() - armedAt < 3000) {
          expect(challengeRequests).toBe(1);
          expect(maxInFlight).toBe(1);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        // The sampling above really happened before the stale challenge landed.
        expect(Date.now() - requestAt).toBeLessThan(4000);

        // The stale response is already queued: only its (gen-guarded) solve
        // settling may consume the deferred re-arm and attach the listeners
        // again, so further activity is allowed to start a new pre-solve.
        challengeDelayMs = 0;
        let secondChallenge = false;
        const deadline = Date.now() + 15_000;
        let nudge = 0;
        while (!secondChallenge && Date.now() < deadline) {
          await page.mouse.move(120 + (nudge++ % 40), 120);
          await new Promise((resolve) => setTimeout(resolve, 250));
          secondChallenge = challengeRequests >= 2;
        }
        expect(secondChallenge).toBe(true);
        // …and never while the stale request was still in flight.
        expect(maxInFlight).toBe(1);
      } finally {
        challengeDelayMs = 0;
      }
    }, 120_000);

    test("an auto failure does not vibrate, a manual one does", async () => {
      resetCounters();
      failChallenges = true;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__errorEvents.length > 0, null, {
          timeout: 30_000,
        });
        await page.waitForTimeout(500);

        expect((await readState()).state).toBe("error");
        expect(await page.evaluate(() => window.__vibrations.length)).toBe(0);
      } finally {
        failChallenges = false;
      }

      // Control: a real, click-driven failure does vibrate.
      resetCounters();
      failChallenges = true;
      try {
        await mountWidget();
        await page.locator("#cap .captcha-trigger").click();
        await page.waitForFunction(() => window.__errorEvents.length > 0, null, {
          timeout: 30_000,
        });

        expect(
          await page.evaluate(() => window.__vibrations.length),
        ).toBeGreaterThan(0);
      } finally {
        failChallenges = false;
      }
    }, 90_000);

    test("a real click during an auto solve does not double-solve", async () => {
      resetCounters();
      challengeDelayMs = 1500;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__progressEvents.length > 0);

        // The trigger is disabled while verifying, but a real click must not
        // produce a second challenge either way.
        await page.locator("#cap .captcha-trigger").click({ force: true });

        await waitForSolve(1);
        await page.waitForTimeout(3000);

        const state = await readState();
        expect(state.solves.length).toBe(1);
        expect(challengeRequests).toBe(1);
        expect(redeemRequests).toBe(1);
        expect(maxInFlight).toBe(1);
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("turning auto on while a speculative solve is in flight reuses it", async () => {
      resetCounters();
      challengeDelayMs = 800;
      try {
        await mountWidget();
        await page.waitForTimeout(300);

        // Arm and start the speculative pre-solver.
        await page.mouse.move(120, 120);
        await page.mouse.move(240, 240);
        await page.waitForTimeout(2700);

        await page.evaluate(() =>
          document
            .getElementById("cap")
            .setAttribute("data-cap-auto", "visible"),
        );

        await waitForSolve(1);
        await page.waitForTimeout(2000);

        const state = await readState();
        expect(state.solves.length).toBe(1);
        expect(state.hidden).toBe(state.solves[0]);
        expect(challengeRequests).toBe(1);
        expect(redeemRequests).toBe(1);
        expect(maxInFlight).toBe(1);
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("an auto solve served from the speculative cache does not vibrate (F5)", async () => {
      resetCounters();
      challengeDelayMs = 800;
      try {
        await mountWidget();
        await page.waitForTimeout(300);

        // Click-only widget: arm and start the speculative pre-solver, then
        // turn auto on while that pre-solve is still in flight (probe E).
        await page.mouse.move(120, 120);
        await page.mouse.move(240, 240);
        await page.waitForTimeout(2700);

        await page.evaluate(() =>
          document
            .getElementById("cap")
            .setAttribute("data-cap-auto", "visible"),
        );

        await waitForSolve(1);
        await page.waitForTimeout(500);

        const state = await readState();
        // The auto solve took the speculative-cache commit path…
        expect(state.solves.length).toBe(1);
        expect(state.hidden).toBe(state.solves[0]);
        expect(challengeRequests).toBe(1);
        expect(redeemRequests).toBe(1);
        // …which must be just as silent as the cold path is for auto solves.
        expect(await page.evaluate(() => window.__vibrations.length)).toBe(0);
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("disconnect and reconnect in the middle of a solve settles on one token", async () => {
      resetCounters();
      challengeDelayMs = 1500;
      try {
        await mountWidget({ attrs: { "data-cap-auto": "load" } });
        await page.waitForFunction(() => window.__progressEvents.length > 0);

        await page.evaluate(() => {
          const w = document.getElementById("cap");
          const parent = w.parentNode;
          w.remove();
          parent.appendChild(w);
        });

        await waitForSolve(1);
        await page.waitForTimeout(3000);

        const state = await readState();
        expect(state.solves.length).toBe(1);
        expect(state.state).toBe("done");
        expect(state.hidden).toBe(state.solves[0]);
        expect(redeemRequests).toBe(1);
        // The aborted first request may still be running server-side.
        expect(maxInFlight).toBeLessThanOrEqual(2);
      } finally {
        challengeDelayMs = 0;
      }
    }, 90_000);

    test("disconnect and reconnect after a solve runs auto exactly once more", async () => {
      resetCounters();
      await mountWidget({ attrs: { "data-cap-auto": "load" } });
      await waitForSolve(1);

      await page.evaluate(() => {
        const w = document.getElementById("cap");
        const parent = w.parentNode;
        w.remove();
        parent.appendChild(w);
      });

      await waitForSolve(2);
      await page.waitForTimeout(2000);

      const state = await readState();
      expect(state.solves.length).toBe(2);
      expect(state.hidden).toBe(state.solves[1]);
      expect(state.state).toBe("done");
      expect(challengeRequests).toBe(2);
      expect(redeemRequests).toBe(2);
      expect(maxInFlight).toBe(1);
    }, 90_000);
  });
}
