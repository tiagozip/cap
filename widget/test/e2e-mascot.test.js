import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}

const SHOULD_RUN_E2E = !process.env.SKIP_E2E && chromium;

if (!SHOULD_RUN_E2E) {
  test.skip("mascot e2e tests skipped (set SKIP_E2E=0 and `bun add playwright`)", () => {});
} else {
  const { makeBaseHandler, setLocalWasmHtml, serveMascot, widgetMin } =
    await import("./test-server.js");
  const { generateChallenge, validateChallenge } = await import(
    "../../core/src/index.js"
  );

  const SECRET = "e2e-mascot-secret-32-bytes-padding-junk-12";

  let server;
  let browser;
  let page;
  let baseUrl;
  const tokens = new Map();

  const htmlPage = (body) =>
    setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>cap widget mascot e2e</title>
</head>
<body>
${body}
</body>
</html>`);

  const TRIGGER_SNIPPET = `<cap-widget id="cap" data-cap-mascot data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/widget.js"></script>`;

  beforeAll(async () => {
    const serve = makeBaseHandler({
      html: htmlPage(
        `<cap-widget id="cap" data-cap-mascot="/mascot" data-cap-api-endpoint="/cap/"></cap-widget>
<cap-widget id="plain" data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/widget.js"></script>`,
      ),
      onChallenge: async () =>
        await generateChallenge(SECRET, {
          challengeCount: 4,
          challengeSize: 16,
          challengeDifficulty: 2,
          scope: "e2e",
        }),
      onRedeem: async (body) => {
        const result = await validateChallenge(SECRET, body, {
          scope: "e2e",
          consumeNonce: (sigHex) => {
            if (tokens.has(sigHex)) return false;
            tokens.set(sigHex, true);
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
    });

    const htmlFor = {
      // window.CAP_MASCOT_URL wins over the script directory.
      "/global": htmlPage(
        `<script>window.CAP_MASCOT_URL = "/global-mascot";</script>
${TRIGGER_SNIPPET}`,
      ),
      // The attribute value wins over window.CAP_MASCOT_URL.
      "/both": htmlPage(
        `<script>window.CAP_MASCOT_URL = "/global-mascot";</script>
<cap-widget id="cap" data-cap-mascot="/attr-mascot/" data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/widget.js"></script>`,
      ),
      // The widget script is served from /nested/, so the default base is
      // /nested/mascot/ — the currentScript resolution path.
      "/nested": htmlPage(
        `<cap-widget id="cap" data-cap-mascot data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/nested/widget.js"></script>`,
      ),
      // /challenge itself fails.
      "/error": htmlPage(
        `<cap-widget id="cap" data-cap-mascot="/mascot/" data-cap-api-endpoint="/fail/"></cap-widget>
<script src="/widget.js"></script>`,
      ),
      // The challenge solves, the redeem is rejected.
      "/error-redeem": htmlPage(
        `<cap-widget id="cap" data-cap-mascot="/mascot/" data-cap-api-endpoint="/failredeem/"></cap-widget>
<script src="/widget.js"></script>`,
      ),
    };

    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: async (req) => {
        const url = new URL(req.url);

        if (url.pathname === "/nested/widget.js") {
          return new Response(widgetMin, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
        // Mascot bytes for the nested/global/attr bases.
        for (const prefix of [
          "/nested/mascot/",
          "/global-mascot/",
          "/attr-mascot/",
        ]) {
          if (url.pathname.startsWith(prefix)) {
            const res = serveMascot(url.pathname);
            if (res) return res;
          }
        }
        if (htmlFor[url.pathname]) {
          return new Response(htmlFor[url.pathname], {
            headers: { "Content-Type": "text/html" },
          });
        }
        if (url.pathname === "/fail/challenge" && req.method === "POST") {
          return Response.json({ error: "challenge unavailable" });
        }
        if (url.pathname === "/failredeem/challenge" && req.method === "POST") {
          return Response.json(
            await generateChallenge(SECRET, {
              challengeCount: 4,
              challengeSize: 16,
              challengeDifficulty: 2,
              scope: "e2e",
            }),
          );
        }
        if (url.pathname === "/failredeem/redeem" && req.method === "POST") {
          return Response.json(
            { success: false, error: "redeem rejected by test" },
            { status: 403 },
          );
        }
        return serve(req);
      },
    });
    baseUrl = `http://127.0.0.1:${server.port}`;

    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  }, 120_000);

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
    if (server) server.stop(true);
  });

  /** The widget's data-state, read from the shadow DOM. */
  const stateOf = (id = "cap") =>
    page.evaluate(
      (widgetId) =>
        document
          .getElementById(widgetId)
          ?.shadowRoot?.querySelector(".captcha")
          ?.getAttribute("data-state") ?? null,
      id,
    );

  /** Snapshot of every mascot <img>: state, resolved src and computed opacity. */
  const imagesOf = (id = "cap") =>
    page.evaluate((widgetId) => {
      const root = document.getElementById(widgetId).shadowRoot;
      return [...root.querySelectorAll("img.cap-mascot-image")].map((img) => ({
        state: img.getAttribute("data-mascot-state"),
        src: img.getAttribute("src"),
        resolvedSrc: img.src,
        alt: img.getAttribute("alt"),
        ariaHidden: img.getAttribute("aria-hidden"),
        opacity: getComputedStyle(img).opacity,
      }));
    }, id);

  const visibleImage = async (id = "cap") => {
    const images = await imagesOf(id);
    const visible = images.filter((img) => img.opacity === "1");
    expect(visible.length).toBe(1);
    return visible[0];
  };

  const waitForState = (state, id = "cap") =>
    page.waitForFunction(
      ({ widgetId, expected }) =>
        document
          .getElementById(widgetId)
          ?.shadowRoot?.querySelector(".captcha")
          ?.getAttribute("data-state") === expected,
      { widgetId: id, expected: state },
      { timeout: 60_000 },
    );

  // The opacity flip is a 200ms transition: wait for it to settle instead of
  // asserting mid-animation.
  const waitForVisible = (state, id = "cap") =>
    page.waitForFunction(
      ({ widgetId, expected }) => {
        const root = document.getElementById(widgetId)?.shadowRoot;
        if (!root) return false;
        const images = [...root.querySelectorAll("img.cap-mascot-image")];
        return images.some(
          (img) =>
            img.getAttribute("data-mascot-state") === expected &&
            getComputedStyle(img).opacity === "1",
        );
      },
      { widgetId: id, expected: state },
      { timeout: 10_000 },
    );

  const open = async (path = "/") => {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document
          .getElementById("cap")
          ?.shadowRoot?.querySelector?.(".captcha-trigger"),
      null,
      { timeout: 10_000 },
    );
  };

  describe("mascot card e2e", () => {
    test("renders the card with the checking pose before any solve", async () => {
      await open("/");

      const state = await stateOf();
      expect(state === null || state === "").toBe(true);

      const images = await imagesOf();
      expect(images.map((img) => img.state).sort()).toEqual([
        "checking",
        "done",
        "error",
      ]);
      for (const img of images) {
        expect(img.alt).toBe("");
        expect(img.ariaHidden).toBe("true");
      }

      const checking = await visibleImage();
      expect(checking.state).toBe("checking");
      expect(checking.resolvedSrc).toBe(
        new URL("/mascot/checking.webp", baseUrl).href,
      );

      // Card chrome: brand wordmark on top, figure, trigger row at the bottom.
      const layout = await page.evaluate(() => {
        const root = document.getElementById("cap").shadowRoot;
        const captcha = root.querySelector(".captcha");
        const figure = root.querySelector(".cap-mascot-figure");
        const trigger = root.querySelector(".captcha-trigger");
        const credits = root.querySelector(".credits");
        return {
          cardHeight: captcha.getBoundingClientRect().height,
          figureHeight: figure.getBoundingClientRect().height,
          figureTop: figure.getBoundingClientRect().top,
          triggerTop: trigger.getBoundingClientRect().top,
          triggerHeight: trigger.getBoundingClientRect().height,
          brandText: credits.textContent,
          brandTop: credits.getBoundingClientRect().top,
          creditsCount: root.querySelectorAll(".credits").length,
          creditsPosition: getComputedStyle(credits).position,
        };
      });

      expect(layout.cardHeight).toBeGreaterThan(240);
      expect(layout.figureHeight).toBeGreaterThanOrEqual(160);
      expect(layout.figureHeight).toBeLessThanOrEqual(180);
      expect(layout.brandTop).toBeLessThan(layout.figureTop);
      expect(layout.triggerTop).toBeGreaterThan(layout.figureTop);
      expect(layout.triggerHeight).toBeGreaterThan(40);
      expect(layout.brandText).toBe("Priestess Verification");
      expect(layout.creditsCount).toBe(1);
      expect(layout.creditsPosition).toBe("static");
    });

    test("shows the done pose after a successful solve", async () => {
      await open("/");

      await page.click("#cap .captcha-trigger");
      await waitForState("done");
      await waitForVisible("done");

      const done = await visibleImage();
      expect(done.state).toBe("done");
      expect(done.resolvedSrc).toBe(new URL("/mascot/done.webp", baseUrl).href);

      const token = await page.evaluate(
        () => document.getElementById("cap").token,
      );
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    }, 90_000);

    test("shows the error pose when the challenge endpoint fails", async () => {
      await open("/error");

      // solve() rejects on failure; the error UI is painted before it does.
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => "errored"),
      );
      await waitForState("error");
      await waitForVisible("error");

      const error = await visibleImage();
      expect(error.state).toBe("error");
      expect(error.resolvedSrc).toBe(
        new URL("/mascot/error.webp", baseUrl).href,
      );
    }, 90_000);

    test("shows the error pose when the redeem endpoint fails", async () => {
      await open("/error-redeem");

      await page.evaluate(() =>
        document
          .getElementById("cap")
          .solve()
          .catch(() => "errored"),
      );
      await waitForState("error");
      await waitForVisible("error");

      const visible = await visibleImage();
      expect(visible.state).toBe("error");
    }, 90_000);

    test("a widget without the attribute stays unchanged and loads no images", async () => {
      await open("/");

      const plain = await page.evaluate(() => {
        const root = document.getElementById("plain").shadowRoot;
        const captcha = root.querySelector(".captcha");
        const trigger = root.querySelector(".captcha-trigger");
        const credits = root.querySelector(".credits");
        return {
          images: root.querySelectorAll("img").length,
          figure: root.querySelectorAll(".cap-mascot-figure").length,
          cardHeight: captcha.getBoundingClientRect().height,
          triggerHeight: trigger.getBoundingClientRect().height,
          brandText: credits.textContent,
          creditsPosition: getComputedStyle(credits).position,
        };
      });

      expect(plain.images).toBe(0);
      expect(plain.figure).toBe(0);
      expect(plain.brandText).toBe("Priestess");
      expect(plain.creditsPosition).toBe("absolute");
      expect(plain.cardHeight).toBeLessThan(100);
      // The trigger fills the card's padding box (1px border on each side).
      expect(plain.triggerHeight).toBeGreaterThan(plain.cardHeight - 4);
    });

    test("resolves the attribute value as the image base (with or without a slash)", async () => {
      await open("/");

      const images = await imagesOf();
      for (const img of images) {
        expect(img.resolvedSrc).toBe(
          new URL(`/mascot/${img.state}.webp`, baseUrl).href,
        );
        expect(img.resolvedSrc).not.toContain("//mascot");
      }
    });

    test("window.CAP_MASCOT_URL is used when the attribute has no value", async () => {
      await open("/global");

      const images = await imagesOf();
      expect(images.length).toBe(3);
      for (const img of images) {
        expect(img.resolvedSrc).toBe(
          new URL(`/global-mascot/${img.state}.webp`, baseUrl).href,
        );
      }
    });

    test("the attribute value wins over window.CAP_MASCOT_URL", async () => {
      await open("/both");

      const images = await imagesOf();
      for (const img of images) {
        expect(img.resolvedSrc).toBe(
          new URL(`/attr-mascot/${img.state}.webp`, baseUrl).href,
        );
      }
    });

    test("falls back to the script directory + mascot/ by default", async () => {
      await open("/nested");

      const images = await imagesOf();
      expect(images.length).toBe(3);
      for (const img of images) {
        expect(img.resolvedSrc).toBe(
          new URL(`/nested/mascot/${img.state}.webp`, baseUrl).href,
        );
      }

      // The images really resolve to the bytes on this origin.
      const status = await page.evaluate(async () =>
        (await fetch("/nested/mascot/checking.webp")).headers.get(
          "content-type",
        ),
      );
      expect(status).toBe("image/webp");
    });

    test("toggling the attribute at runtime rebuilds (and removes) the card", async () => {
      await open("/");

      const before = await page.evaluate(
        () =>
          document.getElementById("plain").shadowRoot.querySelectorAll("img")
            .length,
      );
      expect(before).toBe(0);

      await page.evaluate(() =>
        document
          .getElementById("plain")
          .setAttribute("data-cap-mascot", "/mascot/"),
      );
      await page.waitForFunction(
        () =>
          document
            .getElementById("plain")
            .shadowRoot.querySelectorAll("img.cap-mascot-image").length === 3,
        null,
        { timeout: 5_000 },
      );
      const brand = await page.evaluate(
        () =>
          document.getElementById("plain").shadowRoot.querySelector(".credits")
            .textContent,
      );
      expect(brand).toBe("Priestess Verification");

      await page.evaluate(() =>
        document.getElementById("plain").removeAttribute("data-cap-mascot"),
      );
      const after = await page.evaluate(() => {
        const root = document.getElementById("plain").shadowRoot;
        return {
          images: root.querySelectorAll("img").length,
          figure: root.querySelectorAll(".cap-mascot-figure").length,
          brand: root.querySelector(".credits").textContent,
          position: getComputedStyle(root.querySelector(".credits")).position,
        };
      });
      expect(after.images).toBe(0);
      expect(after.figure).toBe(0);
      expect(after.brand).toBe("Priestess");
      expect(after.position).toBe("absolute");
    });

    test("keeps the has-troubleshoot extra height in card mode", async () => {
      await open("/");

      const measure = () =>
        page.evaluate(() => {
          const root = document.getElementById("cap").shadowRoot;
          const captcha = root.querySelector(".captcha");
          const trigger = root.querySelector(".captcha-trigger");
          const card = captcha.getBoundingClientRect();
          const row = trigger.getBoundingClientRect();
          return {
            card: card.height,
            cardBottom: card.bottom,
            triggerHeight: row.height,
            // The strip the troubleshoot link lives in.
            strip: card.bottom - row.bottom,
          };
        });

      const before = await measure();
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .shadowRoot.querySelector(".captcha")
          .classList.add("has-troubleshoot"),
      );
      // height has a 0.2s transition; let it settle before measuring.
      await page.waitForTimeout(300);
      const after = await measure();
      await page.evaluate(() =>
        document
          .getElementById("cap")
          .shadowRoot.querySelector(".captcha")
          .classList.remove("has-troubleshoot"),
      );

      expect(after.card - before.card).toBeCloseTo(26, 0);
      expect(after.strip - before.strip).toBeCloseTo(26, 0);
      expect(after.triggerHeight).toBeCloseTo(before.triggerHeight, 0);
      expect(after.cardBottom).toBeCloseTo(before.cardBottom + 26, 0);
    });

    test("honours prefers-reduced-motion: no fade transition on the images", async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        await open("/");
        const durations = await page.evaluate(() => {
          const root = document.getElementById("cap").shadowRoot;
          return [...root.querySelectorAll("img.cap-mascot-image")].map(
            (img) => getComputedStyle(img).transitionDuration,
          );
        });
        expect(durations).toEqual(["0s", "0s", "0s"]);
      } finally {
        await page.emulateMedia({ reducedMotion: "no-preference" });
      }
    });
  });
}
