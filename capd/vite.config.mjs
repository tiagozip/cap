import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const page = (name) =>
  fileURLToPath(new URL(`./dashboard/${name}.html`, import.meta.url));

export default defineConfig({
  root: "dashboard",
  base: "./",
  publicDir: false,
  plugins: [tailwindcss(), svelte()],
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
    },
  },
});
