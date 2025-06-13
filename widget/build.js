import fs from "fs/promises";
import { chromium } from "playwright";
import { minify } from "terser";

const min = async (input) => {
  return (
    await minify(input, {
      compress: {
        drop_console: false,
        dead_code: true,
        reduce_vars: true,
      },
      output: {
        beautify: false,
        comments: false,
      },
      mangle: true,
    })
  ).code
    .split("\\n")
    .map((e) => {
      return e.trimStart();
    })
    .join("\\n");
};

console.time("build");

const rawMain = await fs.readFile("./src/src/cap.js", "utf-8");
const minifiedWorker = await min(
  await fs.readFile("./src/src/worker.js", "utf-8")
);

const bundle = rawMain.replace("%%workerScript%%", minifiedWorker);

await fs.writeFile("./src/cap.min.js", bundle);
await fs.writeFile("./src/cap.min.js", await min(bundle));

await fs.writeFile(
  "./src/cap-floating.min.js",
  await min(await fs.readFile("./src/src/cap-floating.js", "utf-8"))
);

console.timeEnd("build");

console.time("test");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () => {
      return new Response(Bun.file("./test.html"));
    },
    "/widget.js": () => {
      return new Response(Bun.file("./src/cap.min.js"), {
        headers: {
          "Content-Type": "application/javascript",
        },
      });
    },
    "/failed": () => {
      console.error("test failed, quitting");
      process.exit(1);
    },
    "/solved": async () => {
      await page.close();
      await browser.close();

      console.timeEnd("test");
      server.stop();

      const publish = prompt("\npublish package to npm? (y/N)");

      if (publish === "y") {
        Bun.spawn({
          cmd: ["bun", "publish", "--access", "public"],
          cwd: "./src",
          stdout: "inherit",
        });
      }

      process.exit(0);
    },
  },
});

page.goto(`http://localhost:3000/`);
