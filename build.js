const fs = require("fs").promises;
const babel = require("@babel/core");
const { minify } = require("terser");

const paths = [
  ["./widget/src/cap.js", "./widget/cap.min.js"],
  ["./widget/src/cap-floating.js", "./widget/cap-floating.min.js"],
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
            targets:
              "last 10 Chrome versions, last 10 Firefox versions, last 10 Safari versions, last 10 Edge versions",
            loose: true,
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
