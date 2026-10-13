import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const widgetMin = fs.readFileSync(
  path.join(__dirname, "..", "src", "cap.min.js"),
  "utf-8",
);
export const floatingMin = fs.readFileSync(
  path.join(__dirname, "..", "src", "cap-floating.min.js"),
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

// The mascot card's three state images, served from /mascot/<state>.webp so the
// default `data-cap-mascot` resolution (script directory + mascot/) has real
// bytes to load in tests.
export const mascotDir = path.join(__dirname, "..", "src", "mascot");
const MASCOT_FILES = new Map(
  ["checking", "error", "done"].map((state) => [
    path.join(mascotDir, `${state}.webp`),
    fs.readFileSync(path.join(mascotDir, `${state}.webp`)),
  ]),
);

export function serveMascot(pathname) {
  const file = MASCOT_FILES.get(path.join(mascotDir, path.basename(pathname)));
  if (!file) return null;
  return new Response(file, { headers: { "Content-Type": "image/webp" } });
}

export function makeBaseHandler({ onChallenge, onRedeem, html, floatingHtml }) {
  return async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/widget.js") {
      return new Response(widgetMin, {
        headers: { "Content-Type": "application/javascript" },
      });
    }
    if (url.pathname.startsWith("/mascot/")) {
      const mascot = serveMascot(url.pathname);
      if (mascot) return mascot;
    }
    if (url.pathname === "/floating.js") {
      return new Response(floatingMin, {
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
    if (url.pathname === "/floating" && floatingHtml) {
      return new Response(floatingHtml, {
        headers: { "Content-Type": "text/html" },
      });
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
