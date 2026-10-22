import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const widgetMin = fs.readFileSync(
  path.join(__dirname, "..", "src", "cap.min.js"),
  "utf-8",
);
export const instrumentationFrame = fs.readFileSync(
  path.join(__dirname, "..", "src", "instrumentation.html"),
  "utf-8",
);

/**
 * Derive the frame's CSP hash from the file itself instead of duplicating the
 * literal. CSP hashes are byte-sensitive and this repo is checked out with
 * core.autocrlf=true, so a hand-copied hash silently goes stale (that is exactly
 * how the shipped literal ended up not matching its own script).
 */
export const instrumentationFrameHash = (() => {
  const body = instrumentationFrame.match(/<script>([\s\S]*?)<\/script>/)[1];
  return (
    "sha256-" +
    crypto.createHash("sha256").update(body, "utf8").digest("base64")
  );
})();
export const wasmBytes = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "wasm",
    "src",
    "browser",
    "cap_wasm_bg.wasm",
  ),
);

export function makeBaseHandler({ onChallenge, onRedeem, html }) {
  return async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/widget.js") {
      return new Response(widgetMin, {
        headers: { "Content-Type": "application/javascript" },
      });
    }
    if (url.pathname === "/instrumentation.html") {
      return new Response(instrumentationFrame, {
        headers: {
          "Content-Type": "text/html",
          "Content-Security-Policy":
            "default-src 'none'; script-src '" + instrumentationFrameHash + "' 'unsafe-eval'; connect-src 'none'; style-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'",
        },
      });
    }
    if (url.pathname === "/cap_wasm_bg.wasm") {
      return new Response(wasmBytes, {
        headers: { "Content-Type": "application/wasm" },
      });
    }
    if (url.pathname === "/" && html) {
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    if (url.pathname === "/cap/challenge" && req.method === "POST") {
      return Response.json(await onChallenge());
    }
    if (url.pathname === "/cap/redeem" && req.method === "POST") {
      const body = await req.json();
      return await onRedeem(body);
    }
    return new Response("not found", { status: 404 });
  };
}

export function setLocalWasmHtml(html) {
  return html.replace(
    "</head>",
    `<script nonce="e2e">window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";</script></head>`,
  );
}
