import path from "node:path";
import { Elysia } from "elysia";

const PUBLIC_ROOT = path.resolve("./public");

const UNAUTHED_ALLOWLIST = new Set([
  "logo-small.webp",
  "assets/ibm-plex-sans.woff2",
  "assets/lilex-regular.woff2",
]);

const resolveSafePath = (rel) => {
  if (!rel || rel.includes("\0") || rel.includes("..")) return null;
  const resolved = path.resolve(PUBLIC_ROOT, rel);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(PUBLIC_ROOT + path.sep)) return null;
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

    const allowUnauthed = UNAUTHED_ALLOWLIST.has(rel);
    const authed = cookie.cap_authed?.value === "yes";

    if (!allowUnauthed && !authed) {
      set.status = 401;
      redirect("/")
      return { success: false, error: "Unauthorized" };
    }

    const f = Bun.file(resolved);
    if (!(await f.exists())) {
      set.status = 404;
      return { success: false, error: "Not found" };
    }

    set.headers["Cache-Control"] = allowUnauthed
      ? "public, max-age=86400"
      : "private, max-age=3600";
    set.headers["X-Content-Type-Options"] = "nosniff";
    set.headers["Content-Type"] = f.type || "application/octet-stream";

    return new Response(f);
  },
);
