const fs = require("fs").promises;
const babel = require("@babel/core");
const { minify } = require("terser");

const paths = [
  ["./src/js/cap.js", "./src/js/min/cap.min.js"],
  ["./src/js/cap-floating.js", "./src/js/min/cap-floating.min.js"],
  ["./src/js/cap-interstitial.js", "./src/js/min/cap-interstitial.min.js"]
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
            targets: "last 10 Chrome versions, last 10 Firefox versions, last 10 Safari versions, last 10 Edge versions",
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
            drop_console: false
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

      function formatBytes(bytes) {
        const sizes = ["B", "kB", "MB", "GB"];
        let i = 0;

        while (bytes >= 1024 && ++i) {
          bytes /= 1024;
        }

        return bytes.toFixed(bytes < 10 && i > 0 ? 1 : 0) + " " + sizes[i];
      }

      const outSize = formatBytes((await fs.stat(outpath)).size);
      console.log(`${outSize}  ${" ".repeat(6 - outSize.length)}${inpath}`);
      /*
      // 5,17,70,75,130,135,335,350,480,600,800,1200
  console.log(`Cap:              ${formatBytes(compressedSize)}`); // 5kB
  console.log("Altcha:           17+  kB");
  console.log("mCaptcha:         70+  kB");
  console.log("Friendly Captcha: 75+  kB");
  console.log("KeyCAPTCHA:       130+ kB");
  console.log("Captcha.eu:       135+ kB");
  console.log("Turnstile:        335+ kB");
  console.log("GeeTest v3:       350+ kB");
  console.log("MTCaptcha:        480+ kB");
  console.log("Recaptcha v2:     600+ kB");
  console.log("GeeTest v4:       800+ kB");
  console.log("hCaptcha:         1.2+ mB");
  console.log(`\nRough size of all files requested by CAPTCHA before solution start, using default settings on their official demo pages. Collected on Firefox Devtools. Note that both some captchas, including Cap use compression by default, which might affect their bundle size`);*/
    }
  );
});
