import {
  cpSync,
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import {
  BEHAVIOR_WEIGHTS,
  DEFAULT_BEHAVIOR_THRESHOLD,
  WEAK_CAP,
} from "../core/src/behavior.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const capd = here("../capd/");
const realApi = here("../capd/dashboard/src/lib/api.js");
const mockApi = here("./src/mock/api.js");
const mockDir = here("./src/mock/");
const outDir = here("../docs/public/demo");
const serverModule = "\0cap-demo-server";

const constant = (file, name) => {
  const source = readFileSync(here(`../capd/src/${file}`), "utf8");
  const start = source.indexOf(`export const ${name} =`);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  const open = source.slice(start).search(/[[{]/) + start;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "[" || source[i] === "{") depth++;
    if (source[i] === "]" || source[i] === "}") depth--;
    if (depth === 0)
      return new Function(`return (${source.slice(open, i + 1)});`)();
  }
  throw new Error(`${name} in ${file} is not closed`);
};

const demoApi = {
  name: "cap-demo-api",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (source === "virtual:cap-demo-server") return serverModule;
    if (!importer || importer.startsWith(mockDir) || !source.endsWith("api.js"))
      return null;
    const resolved = await this.resolve(source, importer, {
      ...options,
      skipSelf: true,
    });
    return resolved?.id === realApi ? mockApi : null;
  },
  load(id) {
    if (id !== serverModule) return null;
    const values = {
      RULE_FIELDS: constant("policy/rules.js", "RULE_FIELDS"),
      OPS: constant("policy/rules.js", "OPS"),
      ACTIONS: constant("policy/rules.js", "ACTIONS"),
      ENTRY_KINDS: constant("policy/lists.js", "ENTRY_KINDS"),
      WEBHOOK_TRIGGERS: constant("policy/webhooks.js", "WEBHOOK_TRIGGERS"),
      risk: {
        weights: BEHAVIOR_WEIGHTS,
        weakCap: WEAK_CAP,
        threshold: DEFAULT_BEHAVIOR_THRESHOLD,
      },
    };
    return Object.entries(values)
      .map(
        ([name, value]) => `export const ${name} = ${JSON.stringify(value)};`,
      )
      .join("\n");
  },
};

const contentTypes = {
  webp: "image/webp",
  json: "application/json",
  svg: "image/svg+xml",
};

const devFiles = {
  name: "cap-demo-dev-files",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/public/", (req, res, next) => {
      const file = join(
        capd,
        "public",
        decodeURIComponent(req.url.split("?")[0]),
      );
      if (
        !file.startsWith(join(capd, "public")) ||
        !existsSync(file) ||
        !statSync(file).isFile()
      )
        return next();
      res.setHeader(
        "Content-Type",
        contentTypes[file.split(".").pop()] ?? "application/octet-stream",
      );
      createReadStream(file).pipe(res);
    });
  },
};

const staticFiles = {
  name: "cap-demo-static",
  apply: "build",
  closeBundle() {
    for (const file of [
      "logo-small.webp",
      "assets/countries-110m.json",
      "assets/flags",
    ])
      cpSync(`${capd}public/${file}`, `${outDir}/public/${file}`, {
        recursive: true,
      });
  },
};

export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [demoApi, devFiles, tailwindcss(), svelte(), staticFiles],
  resolve: { dedupe: ["svelte"] },
  worker: { format: "es", plugins: () => [demoApi] },
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5181,
    fs: { allow: [here("."), capd, here("../core")] },
  },
});
