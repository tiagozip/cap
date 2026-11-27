import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const page = (name) =>
  fileURLToPath(new URL(`./dashboard/${name}.html`, import.meta.url));

const BUDGET_KB = { index: 240, login: 110, share: 195 };

const sizeBudget = () => ({
  name: "size-budget",
  apply: "build",
  generateBundle(_, bundle) {
    const over = [];
    for (const entry of Object.values(bundle)) {
      if (entry.type !== "chunk" || !entry.isEntry) continue;
      const files = new Set();
      const walk = (name) => {
        if (files.has(name)) return;
        files.add(name);
        for (const css of bundle[name].viteMetadata?.importedCss ?? [])
          files.add(css);
        for (const dep of bundle[name].imports ?? []) walk(dep);
      };
      walk(entry.fileName);
      const kb =
        [...files].reduce(
          (n, f) => n + gzipSync(bundle[f].code ?? bundle[f].source).length,
          0,
        ) / 1024;
      const limit = BUDGET_KB[entry.name];
      this.info(`${entry.name}: ${kb.toFixed(1)} kB gzip, budget ${limit} kB`);
      if (limit && kb > limit)
        over.push(`${entry.name} is ${kb.toFixed(1)} kB, over ${limit} kB`);
    }
    if (over.length) this.error(`Bundle over budget: ${over.join("; ")}`);
  },
});

export default defineConfig({
  root: "dashboard",
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), svelte(), sizeBudget()],
  build: {
    outDir: "../public/dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 800,
    manifest: true,
    rollupOptions: {
      input: {
        index: page("index"),
        login: page("login"),
        share: page("share"),
      },
    },
  },
  server: {
    port: 5180,
    proxy: {
      "/server": { target: "http://localhost:3000", ws: true },
      "/public": "http://localhost:3000",
      "/logout": "http://localhost:3000",
      "/auth": "http://localhost:3000",
      "/share/": "http://localhost:3000",
      "/login-background": "http://localhost:3000",
    },
  },
});
