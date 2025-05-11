import fs from "fs/promises";
import { chromium } from "playwright";
import { minify } from "terser";

console.time("build");

const paths = [
  ["./src/src/cap.js", "./src/cap.min.js"],
  ["./src/src/cap.js", "./src/cap.compat.min.js"],
  ["./src/src/cap-floating.js", "./src/cap-floating.min.js"],
];

await Promise.all(
  paths.map(async function ([inpath, outpath]) {
    const input = await fs.readFile(inpath, "utf-8");

    const minified = (
      await minify(input, {
        compress: {
          drop_console: true,
          dead_code: true,
          reduce_vars: true,
          drop_console: false,
        },
        output: {
          beautify: false,
          comments: false,
        },
      })
    ).code
      .split("\\n")
      .map((e) => {
        return e.trimStart();
      })
      .join("\\n");

    await fs.writeFile(outpath, minified);
  })
);

console.timeEnd("build");

console.time("test");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () => {
      return new Response(Bun.file("./test.html"));
    },
    "/failed": () => {
      console.error("test failed, quitting");
      process.exit(1);
    },
    "/solved": () => {
      console.timeEnd("test");
      server.stop();
      browser.close();

      const publish = prompt("\npublish package to npm? (y/N)");

      if (publish === "y") {
        Bun.spawn({
          cmd: ["bun", "publish", "--access", "public"],
          cwd: "./src",
          stdout: "inherit",
        });
      }

      process.exit(0)
    },
  },
});

await page.goto(`http://localhost:3000/`);