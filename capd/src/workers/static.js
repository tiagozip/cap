import { env } from "cloudflare:workers";
import { randomBytes } from "node:crypto";
import { Elysia } from "elysia";

const WIDGET_CDN = "https://cdn.jsdelivr.net";

const pagePolicy = (nonce) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval' ${WIDGET_CDN}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${WIDGET_CDN}`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

export const servePage = async (name, set) => {
  set.headers["content-type"] = "text/html; charset=utf-8";
  set.headers["cache-control"] = "no-cache";
  set.headers["x-content-type-options"] = "nosniff";
  set.headers["x-frame-options"] = "DENY";
  set.headers["referrer-policy"] = "same-origin";
  const res = await env.ASSETS.fetch(
    new Request(`https://assets.local/public/dist/${name}`),
  );
  if (!res.ok)
    return "The dashboard isn't built yet. Run npm run deploy in the workers folder.";
  const nonce = randomBytes(16).toString("base64");
  set.headers["content-security-policy"] = pagePolicy(nonce);
  return (await res.text())
    .replaceAll('"./assets/', '"./public/dist/assets/')
    .replaceAll("<script", `<script nonce="${nonce}"`)
    .replace(
      "<head>",
      `<head><script nonce="${nonce}">window.CAP_SCRIPT_NONCE=${JSON.stringify(nonce)}</script>`,
    );
};

export const publicStatic = new Elysia();
