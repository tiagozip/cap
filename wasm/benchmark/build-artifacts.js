import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.join(__dirname, "..");
export const rustupBin = path.join(process.env.HOME ?? "", ".cargo", "bin", "rustup");
export const rustcBin = path.join(process.env.HOME ?? "", ".cargo", "bin", "rustc");
export const rustBaselineCommit = "da725dba93f61099d264bc597d22ff388d09d2ad";
export const outDir = path.join(__dirname, "out");
export const headDir = path.join(outDir, "head");
export const headBuildDir = path.join(headDir, "build");
export const headBrowserDir = path.join(headDir, "browser");
export const nodeLoaderSrc = path.join(rootDir, "src", "node", "cap_wasm.js");
export const browserLoaderSrc = path.join(rootDir, "src", "browser", "cap_wasm.js");
export const headLoaderDest = path.join(headDir, "cap_wasm.js");
export const headWasm = path.join(headDir, "cap_wasm_bg.wasm");
export const rustDir = path.join(outDir, "rust");
export const rustBrowserDir = path.join(rustDir, "browser");
export const rustSrcDir = path.join(__dirname, "rust");

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

export function buildHead() {
  resetDir(headDir);
  fs.mkdirSync(headBrowserDir, { recursive: true });

  execFileSync(
    "make",
    [
      "-C",
      path.join(rootDir, "src", "c"),
      `BUILD_DIR=${headBuildDir}`,
      `OUT=${path.join(headBuildDir, "cap_wasm.wasm")}`,
      `NODE_WASM=${headWasm}`,
      `BROWSER_WASM=${path.join(headBrowserDir, "cap_wasm_bg.wasm")}`,
    ],
    {
      cwd: rootDir,
      stdio: "inherit",
    },
  );

  fs.copyFileSync(nodeLoaderSrc, headLoaderDest);
  fs.copyFileSync(browserLoaderSrc, path.join(headBrowserDir, "cap_wasm.js"));
}

export function buildRust() {
  resetDir(rustDir);
  fs.mkdirSync(rustBrowserDir, { recursive: true });

  execFileSync(
    rustupBin,
    [
      "run",
      "stable",
      "cargo",
      "build",
      "--manifest-path",
      path.join(rustSrcDir, "Cargo.toml"),
      "--target",
      "wasm32-unknown-unknown",
      "--release",
    ],
    {
      cwd: rootDir,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: path.join(rustDir, "target"),
        RUSTC: rustcBin,
      },
      stdio: "inherit",
    },
  );

  const rustWasmSource = path.join(
    rustDir,
    "target",
    "wasm32-unknown-unknown",
    "release",
    "cap_wasm.wasm",
  );

  const rustNodeLoader = execFileSync(
    "git",
    ["show", `${rustBaselineCommit}:wasm/src/node/cap_wasm.js`],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  const rustNodeLoaderWithStubs = rustNodeLoader
    .replace(
      "imports = {};",
      [
        "imports = {};",
        "module.exports.__wbindgen_describe = function () {};",
        "module.exports.__wbindgen_externref_xform__ = {",
        "  __wbindgen_externref_table_set_null: function () {},",
        "  __wbindgen_externref_table_grow: function () { return 0; },",
        "};",
        "imports.__wbindgen_externref_xform__ = module.exports.__wbindgen_externref_xform__;",
      ].join("\n"),
    )
    .replace("wasm.__wbindgen_start());", "wasm.__wbindgen_start && wasm.__wbindgen_start());");

  fs.writeFileSync(path.join(rustDir, "cap_wasm.js"), rustNodeLoaderWithStubs);
  fs.copyFileSync(rustWasmSource, path.join(rustDir, "cap_wasm_bg.wasm"));
  const rustBrowserTemplate = fs.readFileSync(browserLoaderSrc, "utf8");
  const rustBrowserLoader = rustBrowserTemplate.replace(
    /function __wbg_get_imports\(\) \{[\s\S]*?\n\}\nfunction __wbg_init_memory/,
    `function __wbg_get_imports() {
  const e = { __wbindgen_placeholder__: {}, __wbindgen_externref_xform__: {} };
  e.__wbindgen_placeholder__.__wbindgen_describe = function () {};
  e.__wbindgen_externref_xform__.__wbindgen_externref_table_set_null = function () {};
  e.__wbindgen_externref_xform__.__wbindgen_externref_table_grow = function () { return 0; };
  e.__wbindgen_placeholder__.__wbindgen_externref_xform__ = e.__wbindgen_externref_xform__;
  e.__wbindgen_placeholder__.__wbindgen_init_externref_table = function () {
    const e = wasm.__wbindgen_export_0,
      t = e.grow(4);
    e.set(0, void 0);
    e.set(t + 0, void 0);
    e.set(t + 1, null);
    e.set(t + 2, !0);
    e.set(t + 3, !1);
  };
  return e;
}
function __wbg_init_memory`,
  ).replace("wasm.__wbindgen_start(),", "wasm.__wbindgen_start && wasm.__wbindgen_start(),");
  fs.writeFileSync(path.join(rustBrowserDir, "cap_wasm.js"), rustBrowserLoader);
  fs.copyFileSync(rustWasmSource, path.join(rustBrowserDir, "cap_wasm_bg.wasm"));
}

export function buildAll() {
  buildHead();
  buildRust();
}
