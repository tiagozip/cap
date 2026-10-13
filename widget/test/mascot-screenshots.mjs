/**
 * Renders the `data-cap-mascot` card in its three states and writes them to
 * `worker/.screenshots/mascot-{idle,done,error}.png`.
 *
 *   cd widget && bun run test/mascot-screenshots.mjs
 *
 * Boots a throwaway Bun server that serves the built widget (`src/cap.min.js`),
 * the real `src/mascot/*.webp` bytes and a deliberately cheap challenge/redeem
 * pair, then drives headless Chromium through Playwright. The error shot flips
 * the challenge endpoint to a failing response, so all three states come from
 * the same mounted widget.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateChallenge, validateChallenge } from "../../core/src/index.js";
import { makeBaseHandler, setLocalWasmHtml } from "./test-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "..", "worker", ".screenshots");
const SECRET = "mascot-screenshot-secret-32-bytes-junk-1";
const tokens = new Map();

let failChallenge = false;

const html = setLocalWasmHtml(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>mascot screenshots</title></head>
<body style="margin:0;padding:16px;background:#eef1f6">
<cap-widget id="cap" data-cap-mascot="/mascot/" data-cap-api-endpoint="/cap/"></cap-widget>
<script src="/widget.js"></script>
</body>
</html>`);

const server = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch: makeBaseHandler({
    html,
    onChallenge: async () =>
      failChallenge
        ? { error: "challenge unavailable" }
        : await generateChallenge(SECRET, {
            challengeCount: 4,
            challengeSize: 16,
            challengeDifficulty: 2,
            scope: "screenshot",
          }),
    onRedeem: async (body) => {
      const result = await validateChallenge(SECRET, body, {
        scope: "screenshot",
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
  }),
});

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 420, height: 420 },
  deviceScaleFactor: 2,
});

const baseUrl = `http://127.0.0.1:${server.port}`;

async function waitForState(state) {
  await page.waitForFunction(
    (expected) =>
      document
        .getElementById("cap")
        ?.shadowRoot?.querySelector(".captcha")
        ?.getAttribute("data-state") === expected,
    state,
    { timeout: 60_000 },
  );
}

/** Waits for the 200ms opacity transition to settle before capturing. */
async function waitForPose(state) {
  await page.waitForFunction(
    (expected) =>
      [
        ...document.getElementById("cap").shadowRoot.querySelectorAll("img"),
      ].some(
        (img) =>
          img.getAttribute("data-mascot-state") === expected &&
          getComputedStyle(img).opacity === "1",
      ),
    state,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(150);
}

async function shoot(name) {
  const file = path.join(outDir, `mascot-${name}.png`);
  await page.locator("#cap").screenshot({ path: file });
  console.log(`wrote ${file}`);
}

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(
  () => document.getElementById("cap")?.shadowRoot?.querySelector(".captcha"),
  null,
  { timeout: 10_000 },
);
// Let the mascot webp files finish decoding so the first shot is not blank.
await page.waitForFunction(
  () =>
    [
      ...document.getElementById("cap").shadowRoot.querySelectorAll("img"),
    ].every((img) => img.complete && img.naturalWidth > 0),
  null,
  { timeout: 10_000 },
);
await shoot("idle");

await page.click("#cap .captcha-trigger");
await waitForState("done");
await waitForPose("done");
await shoot("done");

failChallenge = true;
await page.evaluate(() => document.getElementById("cap").reset());
await page.evaluate(() =>
  document
    .getElementById("cap")
    .solve()
    .catch(() => "errored"),
);
await waitForState("error");
await waitForPose("error");
await shoot("error");

await page.close();
await browser.close();
server.stop(true);
