import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium } from "playwright";
import { generateChallenge, validateChallenge } from "../../core/src/index.js";
import { makeBaseHandler, setLocalWasmHtml } from "./test-server.js";

let browser;
let server;
let enabled = true;
let blocking = false;
let lastBody;
let lastResult;
const secret = "interaction-browser-test-secret-32bytes";
const counts = (body) => JSON.parse(body.instr.d).ia;

beforeAll(async () => {
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: makeBaseHandler({
      html: setLocalWasmHtml(`<!doctype html><html><head></head><body>
        <input id="text" aria-label="Text"><input id="password" type="password"><input id="otp" autocomplete="one-time-code">
        <button id="action">Action</button><cap-widget id="cap" data-cap-api-endpoint="/cap/"></cap-widget>
        <script>window.addEventListener("message", e => { if (e.data?.type === "cap:ready" && e.data.observe) window.observing = true; });</script>
        <script src="/widget.js"></script></body></html>`),
      onChallenge: async () =>
        await generateChallenge(secret, {
          challengeCount: 1,
          challengeDifficulty: 1,
          instrumentation: {
            obfuscationLevel: 1,
            detectAutomatedInteractions: enabled,
            blockAutomatedInteractions: blocking,
          },
        }),
      onRedeem: async (body) => {
        lastBody = body;
        lastResult = await validateChallenge(secret, body);
        return Response.json(lastResult);
      },
    }),
  });
  browser = await chromium.launch({
    executablePath: process.env.CAP_TEST_BROWSER,
  });
});

afterAll(async () => {
  await browser?.close();
  server?.stop(true);
});

describe("passive interaction observation", () => {
  test("reports synthetic clicks and typing, then removes listeners", async () => {
    enabled = true;
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${server.port}`);
      await page.waitForFunction(() => window.observing);
      await page.evaluate(() => {
        for (let i = 0; i < 4; i++) {
          document
            .getElementById("action")
            .dispatchEvent(
              new MouseEvent("click", { bubbles: true, detail: 1 }),
            );
          document
            .getElementById("text")
            .dispatchEvent(
              new KeyboardEvent("keydown", { bubbles: true, key: "x" }),
            );
        }
        document.getElementById("cap").solve();
      });
      await page.waitForFunction(() => !!document.getElementById("cap").token);
      expect(lastResult.success).toBe(true);
      expect(lastResult.riskFlags).toContain("interaction_synthetic_clicks");
      expect(lastResult.riskFlags).toContain("interaction_synthetic_keydowns");
      expect(counts(lastBody)).toEqual([4, 4]);
      expect(lastBody.instr.interactions).toBeUndefined();
      expect(await page.locator("iframe").count()).toBe(0);
    } finally {
      await page.close();
    }
  }, 20_000);

  test("leaves trusted input, paste, autofill and passwords alone", async () => {
    enabled = true;
    const page = await browser.newPage({ hasTouch: true });
    try {
      await page.goto(`http://127.0.0.1:${server.port}`);
      await page.waitForFunction(() => window.observing);
      await page.locator("#text").pressSequentially("hello");
      await page.locator("#action").tap();
      await page.locator("#action").click();
      const uncancelled = await page.evaluate(() => {
        const input = document.getElementById("text");
        const events = [];
        for (let i = 0; i < 4; i++) {
          events.push(
            input.dispatchEvent(
              new ClipboardEvent("paste", { bubbles: true, cancelable: true }),
            ),
          );
          events.push(
            input.dispatchEvent(
              new ClipboardEvent("copy", { bubbles: true, cancelable: true }),
            ),
          );
          input.value = "autofilled";
          events.push(
            input.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertReplacementText",
              }),
            ),
          );
          document
            .getElementById("password")
            .dispatchEvent(
              new KeyboardEvent("keydown", { bubbles: true, key: "x" }),
            );
          document
            .getElementById("otp")
            .dispatchEvent(
              new KeyboardEvent("keydown", { bubbles: true, key: "1" }),
            );
        }
        return events.every(Boolean);
      });
      expect(uncancelled).toBe(true);
      expect(await page.locator("#text").inputValue()).toBe("autofilled");
      await page.evaluate(() => {
        document.getElementById("cap").solve();
      });
      await page.waitForFunction(() => !!document.getElementById("cap").token);
      expect(counts(lastBody)).toEqual([0, 0]);
      expect(lastBody.instr.d).not.toContain("hello");
      expect(lastBody.instr.d).not.toContain("autofilled");
      expect(
        lastResult.riskFlags.filter((flag) => flag.startsWith("interaction_")),
      ).toEqual([]);
    } finally {
      await page.close();
    }
  }, 20_000);

  test("counts every script-dispatched click and keydown outside sensitive fields", async () => {
    enabled = true;
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${server.port}`);
      await page.waitForFunction(() => window.observing);
      await page.evaluate(() => {
        const action = document.getElementById("action");
        const text = document.getElementById("text");
        action.click();
        action.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        action.dispatchEvent(
          new MouseEvent("click", { bubbles: true, detail: 1, ctrlKey: true }),
        );
        action.dispatchEvent(
          new PointerEvent("click", {
            bubbles: true,
            detail: 1,
            pointerType: "touch",
          }),
        );
        action.dispatchEvent(
          new PointerEvent("click", {
            bubbles: true,
            detail: 1,
            pointerType: "pen",
          }),
        );
        for (const init of [
          { key: "x", isComposing: true },
          { key: "x", repeat: true },
          { key: "v", ctrlKey: true },
          { key: "Enter" },
        ]) {
          text.dispatchEvent(
            new KeyboardEvent("keydown", { bubbles: true, ...init }),
          );
        }
        document.getElementById("cap").solve();
      });
      await page.waitForFunction(() => !!document.getElementById("cap").token);
      expect(counts(lastBody)).toEqual([5, 4]);
    } finally {
      await page.close();
    }
  }, 20_000);

  test("default-off checks send no interaction report", async () => {
    enabled = false;
    const page = await browser.newPage();
    try {
      await page.goto(`http://127.0.0.1:${server.port}`);
      await page.evaluate(() => {
        document.getElementById("cap").solve();
      });
      await page.waitForFunction(() => !!document.getElementById("cap").token);
      expect(counts(lastBody)).toBeNull();
      expect(await page.evaluate(() => window.observing)).toBeUndefined();
    } finally {
      await page.close();
    }
  }, 20_000);
});

test("mobile interstitial solves without input with interaction blocking enabled", async () => {
  enabled = true;
  blocking = true;
  const page = await browser.newPage({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    await page.goto(`http://127.0.0.1:${server.port}`);
    await page.evaluate(() => {
      document.getElementById("cap").solve();
    });
    await page.waitForFunction(() => !!document.getElementById("cap").token);
    expect(lastResult.success).toBe(true);
    expect(counts(lastBody)).toEqual([0, 0]);
  } finally {
    blocking = false;
    await page.close();
  }
}, 20_000);

test("interaction blocking rejects repeated synthetic key events", async () => {
  enabled = true;
  blocking = true;
  const page = await browser.newPage();
  try {
    await page.goto(`http://127.0.0.1:${server.port}`);
    await page.waitForFunction(() => window.observing);
    const redeemed = page.waitForResponse((response) =>
      response.url().endsWith("/cap/redeem"),
    );
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++)
        document
          .getElementById("text")
          .dispatchEvent(
            new KeyboardEvent("keydown", { bubbles: true, key: "x" }),
          );
      document
        .getElementById("cap")
        .solve()
        .catch(() => {});
    });
    await redeemed;
    expect(lastResult.success).toBe(false);
    expect(lastResult.reason).toBe("instr_automated_interaction");
  } finally {
    blocking = false;
    await page.close();
  }
}, 20_000);
