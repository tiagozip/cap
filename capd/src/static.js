import { randomBytes } from "node:crypto";
import path from "node:path";
import { Elysia } from "elysia";

const PUBLIC_ROOT = path.resolve("./public");

const UNAUTHED_ALLOWLIST = new Set(["logo-small.webp"]);

const PUBLIC_ENTRIES = ["login.html", "share.html"];

let publicDist = { stamp: -1, files: new Set() };

const publicDistFiles = async () => {
  const manifest = Bun.file(path.join(PUBLIC_ROOT, "dist/.vite/manifest.json"));
  if (!(await manifest.exists())) return publicDist.files;
  if (publicDist.stamp === manifest.lastModified) return publicDist.files;
  const chunks = await manifest.json();
  const files = new Set();
  const visit = (key) => {
    const chunk = chunks[key];
    if (!chunk || files.has(`dist/${chunk.file}`)) return;
    files.add(`dist/${chunk.file}`);
    for (const ref of [...(chunk.css ?? []), ...(chunk.assets ?? [])])
      files.add(`dist/${ref}`);
    for (const dep of chunk.imports ?? []) visit(dep);
  };
  for (const entry of PUBLIC_ENTRIES) visit(entry);
  for (const ref of [...files].filter((f) => f.endsWith(".css"))) {
    const css = await Bun.file(path.join(PUBLIC_ROOT, ref)).text();
    for (const [, asset] of css.matchAll(/url\(["']?\.\/([\w.@-]+)["']?\)/g))
      files.add(`dist/assets/${asset}`);
  }
  publicDist = { stamp: manifest.lastModified, files };
  return files;
};

const resolveSafePath = (rel) => {
  if (!rel || rel.includes("\0") || rel.includes("..")) return null;
  const resolved = path.resolve(PUBLIC_ROOT, rel);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(PUBLIC_ROOT + path.sep))
    return null;
  return resolved;
};

const pages = new Map();

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
  const dist = Bun.file(path.join(PUBLIC_ROOT, "dist", name));
  if (!(await dist.exists()))
    return "The dashboard isn't built yet. Run bun run build in the capd folder, then reload.";
  const key = `dist:${name}:${dist.lastModified}`;
  if (!pages.has(key)) {
    for (const old of pages.keys())
      if (old.startsWith(`dist:${name}:`)) pages.delete(old);
    pages.set(
      key,
      (await dist.text()).replaceAll('"./assets/', '"./public/dist/assets/'),
    );
  }
  const nonce = randomBytes(16).toString("base64");
  set.headers["content-security-policy"] = pagePolicy(nonce);
  return pages
    .get(key)
    .replaceAll("<script", `<script nonce="${nonce}"`)
    .replace(
      "<head>",
      `<head><script nonce="${nonce}">window.CAP_SCRIPT_NONCE=${JSON.stringify(nonce)}</script>`,
    );
};

export const publicStatic = new Elysia().get(
  "/public/*",
  async ({ cookie, set, request, redirect }) => {
    const rawPath = new URL(request.url).pathname.replace(/^\/public\/?/, "");
    let rel;
    try {
      rel = decodeURIComponent(rawPath);
    } catch {
      set.status = 400;
      return { success: false, error: "Bad request" };
    }

    const resolved = resolveSafePath(rel);
    if (!resolved) {
      set.status = 404;
      return { success: false, error: "Not found" };
    }

    const publicBuild = (await publicDistFiles()).has(rel);
    const allowUnauthed =
      publicBuild ||
      UNAUTHED_ALLOWLIST.has(rel) ||
      rel.startsWith("assets/flags/");
    const authed = cookie.cap_authed?.value === "yes";

    if (!allowUnauthed && !authed) {
      set.status = 401;
      redirect("/");
      return { success: false, error: "Unauthorized" };
    }

    const f = Bun.file(resolved);
    if (!(await f.exists())) {
      set.status = 404;
      return { success: false, error: "Not found" };
    }

    set.headers["content-type"] = f.type || "application/octet-stream";
    set.headers["cache-control"] = publicBuild
      ? "public, max-age=31536000, immutable"
      : allowUnauthed
        ? "public, max-age=86400"
        : rel.startsWith("dist/assets/")
          ? "private, max-age=31536000, immutable"
          : "private, max-age=3600";
    set.headers["x-content-type-options"] = "nosniff";

    return f;
  },
);
