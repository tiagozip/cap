/**
 * Real-browser acceptance for the demo page: opens `/`, clicks the widget,
 * waits for the PoW + instrumentation round trip and the same-origin
 * `/demo/siteverify` call, records every request the page makes, asserts that
 * nothing is fetched from `cdn.jsdelivr.net` (the Worker self-hosts the widget,
 * its wasm files and pako), then writes a full-page screenshot.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=<repo>/widget/node_modules/.pv-tools/pw-browsers \
 *     node scripts/browser-e2e.mjs http://127.0.0.1:8787
 *
 * Requires a running `wrangler dev` and a playwright install (the widget's
 * devDependency is reused when the worker itself has none).
 */

import { mkdirSync } from "node:fs";
import { chromium } from "./playwright.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8787";
const screenshotPath =
  process.argv[3] ??
  new URL("../.screenshots/demo-success.png", import.meta.url).pathname;

mkdirSync(new URL("../.screenshots/", import.meta.url), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

const logs = [];
page.on("console", (message) =>
  logs.push(`[${message.type()}] ${message.text()}`),
);
page.on("pageerror", (error) => logs.push(`[pageerror] ${error.message}`));

const requests = [];
page.on("request", (request) => requests.push(request.url()));

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

await page.waitForFunction(
  () =>
    document
      .querySelector("cap-widget")
      ?.shadowRoot?.querySelector(".captcha-trigger"),
  null,
  { timeout: 20_000 },
);

await page.locator("cap-widget:not([data-cap-mascot]) .captcha-trigger").click({ timeout: 20_000 });

await page.waitForFunction(
  () =>
    document.getElementById("result")?.textContent?.includes('"success": true'),
  null,
  { timeout: 120_000 },
);

const result = (await page.textContent("#result"))?.trim();
// Let the widget finish its solved-state repaint before capturing.
await page.waitForTimeout(500);
await page.screenshot({ path: screenshotPath, fullPage: true });
await browser.close();

const jsdelivr = requests.filter((url) => url.includes("cdn.jsdelivr.net"));
const origin = new URL(baseUrl).origin;
const offOrigin = requests.filter(
  (url) => !url.startsWith(origin) && !url.startsWith("blob:"),
);

console.log(`result box:\n${result}`);
console.log(`screenshot: ${screenshotPath}`);
console.log(`requests (${requests.length}):`);
for (const url of requests) console.log(`  ${url}`);
console.log(`browser logs (${logs.length}):`);
for (const line of logs) console.log(`  ${line}`);

if (!result?.includes('"success": true')) {
  console.error("FAIL: the demo flow did not report success");
  process.exitCode = 1;
}
if (jsdelivr.length > 0) {
  console.error(`FAIL: ${jsdelivr.length} request(s) went to cdn.jsdelivr.net`);
  process.exitCode = 1;
} else {
  console.log("OK: no requests to cdn.jsdelivr.net");
}
if (offOrigin.length > 0) {
  console.log(
    `note: ${offOrigin.length} request(s) left ${origin}: ${offOrigin.join(", ")}`,
  );
}
