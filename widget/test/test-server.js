import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const widgetMin = fs.readFileSync(
  path.join(__dirname, "..", "src", "cap.min.js"),
  "utf-8",
);
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
    `<script>window.CAP_CUSTOM_WASM_URL = "/cap_wasm_bg.wasm";</script></head>`,
  );
}
