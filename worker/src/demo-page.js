/**
 * The demo page served at `/`. It mounts the stock `<cap-widget>` against this
 * same origin and, once the widget solves a challenge, calls
 * `POST /demo/siteverify` — a same-origin-only route that runs the exact same
 * server-side verification as `/siteverify` with the Worker's secret, so no
 * secret ever reaches the browser.
 *
 * A second widget next to it opts into the `data-cap-mascot` card; with a bare
 * attribute the images resolve through the widget's default
 * `<script directory>/mascot/` base, which this Worker serves at
 * `/mascot/*.webp` (see `src/widget.js`).
 *
 * The widgets use their own `/demo/challenge` + `/demo/redeem` endpoints
 * (`data-cap-api-endpoint="/demo/"`): those issue demo-scoped tokens, the only
 * kind `/demo/siteverify` accepts. The `window.CAP_CUSTOM_*` variables point
 * the widget's wasm and pako fetches at this origin instead of jsDelivr; they
 * must be set before the widget script loads.
 */

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderDemoPage({ capWasm, hashwx, pako }) {
  // Relative URLs keep the widget same-origin no matter how the page is
  // reached. An absolute `url.origin` would break `wrangler dev`, where the
  // custom-domain route makes the Worker see `http://verify.rakko.cn` while
  // the browser is talking to `http://127.0.0.1:8787`.
  const endpoint = "/demo/";
  const assetScript = [
    "    <script>",
    `      window.CAP_CUSTOM_WASM_URL = ${jsonForScript(capWasm)};`,
    `      window.CAP_CUSTOM_HASHWX_URL = ${jsonForScript(hashwx)};`,
    `      window.CAP_PAKO_URL = ${jsonForScript(pako)};`,
    "    </script>",
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Priestess Verification</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      body {
        margin: 0 auto;
        max-width: 46rem;
        padding: 2rem 1.25rem 3rem;
        line-height: 1.55;
      }
      h1 {
        font-size: 1.5rem;
        margin-bottom: 0.25rem;
      }
      h2 {
        font-size: 1rem;
        margin: 1rem 0 0.5rem;
      }
      p {
        margin: 0.5rem 0;
      }
      .panel {
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        border-radius: 8px;
        margin-top: 1.5rem;
        padding: 1rem;
      }
      code,
      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.875rem;
      }
      pre {
        background: color-mix(in srgb, currentColor 8%, transparent);
        border-radius: 6px;
        margin: 0.75rem 0 0;
        min-height: 3.5rem;
        overflow-x: auto;
        padding: 0.75rem;
        white-space: pre-wrap;
        word-break: break-word;
      }
      button {
        font: inherit;
        margin-top: 0.75rem;
        padding: 0.3rem 0.8rem;
      }
      footer {
        border-top: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        font-size: 0.875rem;
        margin-top: 2.5rem;
        padding-top: 1rem;
      }
    </style>
  </head>
  <body>
    <h1>Priestess Verification</h1>
    <p>
      This page is served by the Cloudflare Workers deployment of Priestess
      Verification. Solve the challenge below; the page then sends the token to
      the server-side verification endpoint and prints the result.
    </p>
    <div class="panel">
      <h2>Default widget</h2>
      <cap-widget data-cap-api-endpoint="${endpoint}"></cap-widget>
      <h2>Mascot card (<code>data-cap-mascot</code>)</h2>
      <cap-widget id="mascot-widget" data-cap-mascot data-cap-api-endpoint="${endpoint}"></cap-widget>
      <button id="reset" type="button">Reset</button>
      <pre id="result">Waiting for the widget to be solved…</pre>
    </div>
    <p>
      The widget talks to <code>/demo/challenge</code> and
      <code>/demo/redeem</code> on this origin, with its wasm and pako files
      served from this origin too. The card on the right is the opt-in
      <code>data-cap-mascot</code> layout: its three state images load from
      <code>/mascot/&lt;state&gt;.webp</code>, the default base derived from the
      <code>/widget.js</code> script directory. The verification below uses
      <code>POST /demo/siteverify</code>, which only accepts demo-scoped
      tokens; the siteverify secret stays on the server.
    </p>
${assetScript}
    <script src="/widget.js"></script>
    <script>
      const widgets = [...document.querySelectorAll("cap-widget")];
      const nameOf = (widget) =>
        widget.hasAttribute("data-cap-mascot") ? "mascot card" : "default widget";
      const result = document.getElementById("result");
      const show = (value) => {
        result.textContent =
          typeof value === "string" ? value : JSON.stringify(value, null, 2);
      };

      document.getElementById("reset").addEventListener("click", () => {
        for (const widget of widgets) widget.reset();
        show("Waiting for the widget to be solved…");
      });

      for (const widget of widgets) {
        widget.addEventListener("solve", async (event) => {
          show("[" + nameOf(widget) + "] Calling /demo/siteverify…");
          try {
            const res = await fetch("/demo/siteverify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ response: event.detail.token }),
            });
            const data = await res.json();
            show({ widget: nameOf(widget), status: res.status, ...data });
          } catch (error) {
            show(
              "[" +
                nameOf(widget) +
                "] Verification request failed: " +
                error.message,
            );
          }
        });

        widget.addEventListener("error", (event) => {
          show({ widget: nameOf(widget), widget_error: event.detail });
        });
      }
    </script>
    <footer>
      Based on Cap by Tiago (Apache-2.0) —
      <a href="https://github.com/tiagozip/cap">tiagozip/cap</a>.
    </footer>
  </body>
</html>
`;
}
