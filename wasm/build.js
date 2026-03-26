import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { minify } from "terser";

const cSrcDir = path.join(process.cwd(), "./src/c");
const nodeOutDir = path.join(process.cwd(), "./src/node");
const browserOutDir = path.join(process.cwd(), "./src/browser");
const wasmOutPath = path.join(cSrcDir, "build", "cap_wasm.wasm");

console.log(`Building C wasm...`);
execSync(`make -C "${cSrcDir}" clean`, { stdio: "inherit" });
execSync(`make -C "${cSrcDir}"`, { stdio: "inherit" });

console.log(`\n  Syncing wasm binary to package outputs...`);
fs.copyFileSync(wasmOutPath, path.join(nodeOutDir, "cap_wasm_bg.wasm"));
fs.copyFileSync(wasmOutPath, path.join(browserOutDir, "cap_wasm_bg.wasm"));

console.log(`\n  Minifing loaders...`);

await Promise.all(
  [browserOutDir, nodeOutDir].map(async (dir) => {
    const loaderPath = path.join(dir, "cap_wasm.js");
    const code = fs.readFileSync(loaderPath, "utf8");
    const result = await minify(code);
    fs.writeFileSync(loaderPath, result.code);
  }),
);

console.log(`\n🎉 All builds finished successfully!\n`);

const doTest = prompt("test build? (y/N):").toLowerCase() === "y";

if (!doTest) {
  process.exit(0);
}

console.log(`\n  test...`);
execSync(`bun ${path.join("test", "node.js")}`, { stdio: "inherit" });

console.log(`\n  testing odd difficulty...`);
execSync(`bun ${path.join("test", "node_odd_difficulty.js")}`, {
  stdio: "inherit",
});

console.log(`\n  test finished!`);

const doPublish = prompt("publish build? (y/N):").toLowerCase() === "y";
if (!doPublish) {
  process.exit(0);
}
Bun.spawn({
  cmd: ["bun", "publish", "--access", "public"],
  cwd: "./src",
  stdout: "inherit",
});
