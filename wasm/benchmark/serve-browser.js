import fs from "node:fs";
import path from "node:path";
import { buildAll, __dirname } from "./build-artifacts.js";

const rootDir = __dirname;
const requestedPort = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : null;
const host = process.env.HOST ?? "127.0.0.1";
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".json", "application/json; charset=utf-8"],
]);

function resolveFile(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = url.pathname === "/" ? "/browser/index.html" : url.pathname;
  const filePath = path.join(rootDir, pathname);
  const normalizedRoot = path.resolve(rootDir);
  const normalizedFile = path.resolve(filePath);

  if (!normalizedFile.startsWith(normalizedRoot + path.sep) && normalizedFile !== normalizedRoot) {
    return null;
  }

  return normalizedFile;
}

await buildAll();

function createServer(port) {
  return Bun.serve({
    hostname: host,
    port,
    fetch(req) {
      const filePath = resolveFile(new URL(req.url).pathname);

      if (!filePath) {
        return new Response("Forbidden", { status: 403 });
      }

      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch {
        return new Response("Not found", { status: 404 });
      }

      const targetPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      let body;
      try {
        body = fs.readFileSync(targetPath);
      } catch {
        return new Response("Not found", { status: 404 });
      }

      const ext = path.extname(targetPath);
      return new Response(body, {
        headers: {
          "Content-Type": mimeTypes.get(ext) ?? "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      });
    },
  });
}

const candidatePorts =
  requestedPort !== null && Number.isFinite(requestedPort)
    ? [requestedPort]
    : Array.from({ length: 200 }, (_, index) => 49152 + ((Date.now() + index) % 1000)).concat([
        8787,
        4173,
        8081,
        18080,
        3000,
      ]);

let lastError;
for (const candidatePort of candidatePorts) {
  try {
    const server = createServer(candidatePort);
    console.log(`Serving ${path.join(rootDir, "browser", "index.html")} at ${server.url}`);
    lastError = null;
    break;
  } catch (error) {
    lastError = error;
  }
}

if (lastError) {
  throw lastError;
}
