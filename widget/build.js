import fs from "fs/promises";
import { minify } from "terser";

const paths = [
  ["./src/src/cap.js", "./src/cap.min.js"],
  ["./src/src/cap.js", "./src/cap.compat.min.js"],
  ["./src/src/cap-floating.js", "./src/cap-floating.min.js"],
];

paths.forEach(async function ([inpath, outpath]) {
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
});
