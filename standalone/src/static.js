import path from "node:path";
import { Elysia } from "elysia";
import { isDemoMode } from "./demo.js";

const PUBLIC_ROOT = path.resolve("./public");

const UNAUTHED_ALLOWLIST = new Set([
  "logo-small.webp",
  "assets/ibm-plex-sans.woff2",
  "assets/lilex-regular.woff2",
  "assets/style.css",
  "assets/chart.js@4.5.0.min.js",
  "js/geo.js",
  "js/share.js",
]);

const resolveSafePath = (rel) => {
  if (!rel || rel.includes("\0") || rel.includes("..")) return null;
  const resolved = path.resolve(PUBLIC_ROOT, rel);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(PUBLIC_ROOT + path.sep))
    return null;
  return resolved;
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

    const allowUnauthed =
      UNAUTHED_ALLOWLIST.has(rel) || rel.startsWith("assets/flags/");
    const authed = cookie.cap_authed?.value === "yes" || isDemoMode();

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
    set.headers["cache-control"] = allowUnauthed
      ? "public, max-age=86400"
      : "private, max-age=3600";
    set.headers["x-content-type-options"] = "nosniff";

    return f;
  },
);
