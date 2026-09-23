import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { generateChallenge, validateChallenge } from "capjs-core";
import { Elysia, file } from "elysia";
import { transform } from "lightningcss";
import {
  keys as i18nKeyList,
  shipped as i18nShipped,
  shippedKeys as i18nShippedKeys,
  translations as i18nTranslations,
} from "../widget/src/src/i18n/translations.js";

const SECRET = process.env.CAP_SECRET || randomBytes(32).toString("hex");

const redeemed = new Map();
const nonces = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of redeemed) if (v <= now) redeemed.delete(k);
  for (const [k, v] of nonces) if (v <= now) nonces.delete(k);
}, 60_000).unref();

const consumeNonce = async (sigHex, ttlMs) => {
  if (nonces.has(sigHex)) return false;
  nonces.set(sigHex, Date.now() + ttlMs);
  return true;
};

const processCSS = async () => {
  const raw = await fs.readFile("../widget/src/src/cap.css", "utf-8");
  const { code } = transform({
    filename: "cap.css",
    code: Buffer.from(raw),
    minify: true,
    targets: {
      chrome: 90 << 16,
      firefox: 90 << 16,
      safari: 14 << 16,
    },
  });
  return code.toString();
};

const keepIdx = i18nShippedKeys.map((k) => {
  const i = i18nKeyList.indexOf(k);
  if (i === -1) throw new Error(`shippedKey '${k}' not in keys`);
  return i;
});
const i18nRows = {};
for (const code of i18nShipped) {
  if (!i18nTranslations[code]) throw new Error(`shipped lang '${code}' missing`);
  i18nRows[code] = keepIdx.map((i) => i18nTranslations[code][i]).join("/");
}
const i18nJSON = JSON.stringify(i18nRows);

const app = new Elysia();

app.get("/", () => file("./index.html"));

app.get("/cap.js", async ({ set }) => {
  const main = await fs.readFile("../widget/src/src/cap.js", "utf-8");
  const worker = await fs.readFile("../widget/src/src/worker.js", "utf-8");
  const css = await processCSS();

  const bundle = main
    .replace("%%workerScript%%", () => JSON.stringify(worker))
    .replace("%%capCSS%%", () => css)
    .replace("%%i18nKeys%%", () => i18nShippedKeys.join(","))
    .replace("%%i18nData%%", () => i18nJSON);

  set.headers = { "Content-Type": "application/javascript" };
  return bundle;
});

app.get("/cap-floating.js", () => file("../widget/src/src/cap-floating.js"));

app.get("/cap.css", async ({ set }) => {
  set.headers = { "Content-Type": "text/css" };
  return processCSS();
});

app.post("/api/challenge", async () => {
  return await generateChallenge(SECRET, {
    instrumentation: true,
  });
});

app.post("/api/redeem", async ({ body, set }) => {
  if (!body || typeof body !== "object") {
    set.status = 400;
    return { success: false, reason: "invalid_body" };
  }

  const result = await validateChallenge(SECRET, body, { consumeNonce });

  if (result.success) {
    redeemed.set(result.tokenKey, result.expires);
    console.log("redeemed:", {
      tokenKey: result.tokenKey,
      expires: new Date(result.expires).toISOString(),
    });
  }

  return result;
});

app.post("/api/validate", async ({ body, set }) => {
  if (!body?.token) {
    set.status = 400;
    return { success: false };
  }
  const [id, secret] = String(body.token).split(":");
  if (!id || !secret) return { success: false };

  const { createHash } = await import("node:crypto");
  const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;

  const expires = redeemed.get(tokenKey);
  if (!expires || expires < Date.now()) return { success: false };

  return { success: true, expires };
});

const port = Number(process.env.PORT) || 3000;
app.listen(port);
console.log(`Server is running on http://localhost:${port}`);
