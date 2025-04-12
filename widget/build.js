import fs from "fs/promises"
import babel from "@babel/core"
import { minify } from "terser";

const paths = [
  ["./src/src/cap.js", "./src/cap.min.js"],
  ["./src/src/cap.js", "./src/cap.compat.min.js"],
  ["./src/src/cap-floating.js", "./src/cap-floating.min.js"],
];

paths.forEach(async function ([inpath, outpath]) {
  const input = await fs.readFile(inpath, "utf-8");

  babel.transform(
    input,
    {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: outpath.includes(".compat")
              ? "last 600 Chrome versions, last 600 Firefox versions, last 20 Safari versions, last 20 Edge versions"
              : "last 20 Chrome versions, last 15 Firefox versions, last 10 Safari versions, last 10 Edge versions",
            loose: true
          },
        ],
      ],
    },
    async function (err, result) {
      if (err) {
        throw new Error(err);
      }

      const minified = (
        await minify(result.code, {
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
    }
  );
});
