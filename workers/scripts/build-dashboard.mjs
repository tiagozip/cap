import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const capd = fileURLToPath(
  new URL(process.argv[2] ?? "../../capd/", import.meta.url),
);
const root = fileURLToPath(new URL("../dashboard/", import.meta.url));
const core = `${capd}node_modules/capjs-core`;
if (!existsSync(`${capd}node_modules/elysia`))
  execFileSync("bun", ["install", "--frozen-lockfile"], {
    cwd: capd,
    stdio: "inherit",
  });
if (!lstatSync(core, { throwIfNoEntry: false })?.isSymbolicLink()) {
  rmSync(core, { recursive: true, force: true });
  symlinkSync("../../core", core);
}
rmSync(root, { recursive: true, force: true });
execFileSync(
  "npx",
  ["vite", "build", "--outDir", `${root}public/dist`, "--emptyOutDir"],
  { cwd: capd, stdio: "inherit" },
);
cpSync(`${capd}public/assets`, `${root}public/assets`, {
  recursive: true,
});
cpSync(`${capd}public/logo-small.webp`, `${root}public/logo-small.webp`);
writeFileSync(`${root}.assetsignore`, "public/dist/.vite\n");
