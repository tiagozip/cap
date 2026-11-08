---
outline: [2, 3]
description: "Cap's client widget requests, solves and displays proof-of-work challenges with a native web component and WASM. Install it, use it in any framework, and customize it."
---

# Widget

The widget is a `<cap-widget>` web component. It fetches a challenge from your server, solves it in Web Workers with WebAssembly, and gives you a token to verify.

## Install

::: code-group

```sh [npm]
npm i cap-widget
```

```sh [pnpm]
pnpm add cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

:::

Pin a version from the [releases page](https://github.com/tiagozip/cap/releases) when you use the CDN. jsDelivr is blocked in parts of China, so if your visitors are there, install from npm or [self-host the widget](#self-hosting-the-widget).

## Usage

Point `data-cap-api-endpoint` at your server. For capd, that's `https://<instance>/<site-key>/`.

::: code-group

```html [HTML]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>

<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

```jsx [React]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      onsolve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```vue [Vue]
<script setup>
import "cap-widget";
</script>

<template>
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    @solve="(e) => console.log(e.detail.token)"
  />
</template>
```

```svelte [Svelte]
<script>
  import "cap-widget";
</script>

<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  onsolve={(e) => console.log(e.detail.token)}
></cap-widget>
```

```jsx [Solid]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      on:solve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```tsx [Qwik]
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => (
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    on:solve$={(e: CustomEvent) => console.log(e.detail.token)}
  />
));
```

```astro [Astro]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/" />

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

:::

A few framework notes:

- React handles custom element events properly from version 19. Preact uses the same syntax.
- Vue may warn about an unknown component. Tell its compiler that `cap-` tags are custom elements:

  ```js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } })
  ```

- The Svelte example is Svelte 5. On Svelte 4, use `on:solve`.

### In a form

Inside a `<form>`, the widget adds a hidden `cap-token` input when it's solved, so the token is submitted with the other fields. Add `required` to stop the form from submitting before then.

```html
<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

To solve without showing a widget, use [invisible mode](./invisible.md). To show it only when a button is pressed, use [floating mode](./floating.md).

## When it fetches and solves

The widget doesn't wait for a click to start working. Once it's visible on the page, it fetches a challenge and starts the [instrumentation](./instrumentation.md) frame, which watches the page until the solve finishes. It fetches again a while before the challenge expires, using the challenge's lifetime from its token. For a 10 minute challenge, that's 90 seconds before expiry for SHA-256 and 3 minutes before for HashWX.

The first mouse move, touch or key press on the page starts a speculative solve. For a [format 2](./capjs-core.md#format-2-hashwx) challenge, which HashWX uses, the widget only downloads the HashWX module ahead of time. For a format 1 SHA-256 challenge, it waits 2.5 seconds and then solves in a single worker, and a click on the widget moves the rest of the solve onto all its workers. When the key doesn't need interaction data, the widget also redeems the solution in the background and keeps the token, so the click on the widget returns at once. When the key checks interactions or scores behavior, it waits for the click to redeem, because the click is part of what the server checks. If the server rejected a background redeem, the click shows that error.

## Events

Each event is a `CustomEvent`.

| Event | Fires when | `detail` |
| --- | --- | --- |
| `solve` | The challenge is solved | `{ token }` |
| `progress` | Solving progresses | `{ progress }`, from 0 to 100 |
| `error` | Something fails | `{ isCap, code, message }`. The codes are listed in [troubleshooting](./error-codes.md). |
| `reset` | The widget resets | `{}` |

## Attributes

| Attribute | What it does |
| --- | --- |
| `data-cap-api-endpoint` | Your server's endpoint. Required. |
| `data-cap-worker-count` | Number of solver workers. Defaults to the number of CPU cores, or 8. |
| `data-cap-hidden-field-name` | Name of the hidden form input. Defaults to `cap-token`. |
| `data-cap-lang` | Forces a [language](#languages). |
| `data-cap-troubleshooting-url` | Where the troubleshooting link points when a visitor is blocked. |
| `data-cap-disable-haptics` | Turns off vibration on phones. |
| `required` | Blocks form submission until the widget is solved. |

## Languages

The widget follows the browser's language for Arabic, Chinese (Simplified), French, German, Hindi, Japanese, Portuguese, Russian and Spanish, and uses English otherwise. Set `data-cap-lang="de"` on a widget, or `window.CAP_LANG = "de"` for the whole page, to choose one yourself.

To change any label, set its `data-cap-i18n-*` attribute:

```html
<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  data-cap-i18n-initial-state="I'm not a robot"
  data-cap-i18n-solved-label="Done"
></cap-widget>
```

The keys are `initial-state`, `verifying-label`, `solved-label`, `error-label`, `csp-error-label`, `required-label`, `troubleshooting-label`, `wasm-disabled`, and the screen reader labels `group-aria-label`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label` and `error-aria-label`.

## Styling

Override these CSS variables on `cap-widget`. The values shown are the defaults.

```css
cap-widget {
  --cap-background: #fdfdfd;
  --cap-border-color: #dddddd8f;
  --cap-border-radius: 14px;
  --cap-widget-height: 30px;
  --cap-widget-width: 230px;
  --cap-widget-padding: 14px;
  --cap-gap: 15px;
  --cap-color: #212121;
  --cap-checkbox-size: 25px;
  --cap-checkbox-border: 1px solid #aaaaaad1;
  --cap-checkbox-border-radius: 6px;
  --cap-checkbox-background: #fafafa91;
  --cap-checkbox-margin: 2px;
  --cap-font: system-ui, -apple-system, sans-serif;
  --cap-spinner-color: #000;
  --cap-spinner-background-color: #eee;
  --cap-spinner-thickness: 5px;
}
```

## Page-wide options {#options}

Set these on `window` before the widget loads.

| Option | What it does |
| --- | --- |
| `CAP_CUSTOM_FETCH` | Replaces `fetch` for the widget's requests. |
| `CAP_CSS_NONCE` | Nonce for the injected `<style>` tag, for a strict Content Security Policy. Also used for scripts if `CAP_SCRIPT_NONCE` is unset. |
| `CAP_SCRIPT_NONCE` | Nonce for injected scripts: the decompression fallback and the instrumentation iframe. |
| `CAP_ISOLATE` | Runs the instrumentation frame without your page's origin. See [pages with an HTML injection bug](#pages-with-an-html-injection-bug). |
| `CAP_PAKO_URL` | URL of `pako_inflate.min.js`, which the widget loads only in browsers without `DecompressionStream`. |
| `CAP_CUSTOM_WASM_URL` | URL of `cap_wasm_bg.wasm`. |
| `CAP_CUSTOM_HASHWX_URL` | URL of `hashwx.wasm`. |
| `CAP_LANG` | Forces a [language](#languages) on every widget. |
| `CAP_DISABLE_HAPTICS` | Turns off vibration on every widget. |
| `CAP_DISABLE_WIDGET_REF` | Leaves your page's address out of the link behind the widget's Cap credit. |
| `CAP_DEBUG` | Logs each step of fetching and solving to the console. |
| `CAP_SILENT` | Turns off all of the widget's console output. |

## Content Security Policy

The widget works under a strict Content Security Policy. It needs these sources:

| Directive | Source | Why |
| --- | --- | --- |
| `script-src` | `'nonce-...'` or the widget's host | Loads the widget script. |
| `script-src` | `'wasm-unsafe-eval'` | Compiles the WebAssembly solver. |
| `worker-src` | `blob:` | Runs the solver in Web Workers created from a blob URL. |
| `connect-src` | your Cap server, and `cdn.jsdelivr.net` unless you [self-host](#self-hosting-the-widget) | Fetches challenges, redeems them, and downloads the WASM files. |
| `style-src` | `'nonce-...'` | Allows the widget's injected `<style>` tag. Set `CAP_CSS_NONCE`. |

The [instrumentation](./instrumentation.md) script runs in a `srcdoc` iframe, which inherits the page's policy. The widget adds a nonce to that script, and to the pako fallback script in older browsers, only if you set `window.CAP_SCRIPT_NONCE` to the nonce from your `script-src` before the widget loads. Without it, the browser blocks the script, and the solve fails 250 ms after the frame loads. The widget shows "Blocked by this page", fires an `error` event with the code `instr_csp_blocked`, and logs a console error that points here. The server records the failure under the same code. If you load pako from somewhere other than jsDelivr, set `CAP_PAKO_URL` and allow that host in `script-src`.

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_CSS_NONCE = "r4nd0m";
</script>
<script nonce="r4nd0m" src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

```
Content-Security-Policy: script-src 'nonce-r4nd0m' 'wasm-unsafe-eval'; worker-src blob:; style-src 'nonce-r4nd0m'; connect-src 'self' https://cdn.jsdelivr.net
```

Generate a new nonce for every response. If you serve the widget from capd's `/assets`, allow your Cap server in `script-src` and `connect-src` and drop jsDelivr.

You don't need `'unsafe-eval'`. Some of the instrumentation checks use `eval` and `new Function`. When both throw an `EvalError`, the script skips those checks, runs the rest, and the server adds `csp_eval_blocked` to `riskFlags`. If only one of them throws, the script treats it as tampering and fails with `instr_natives_tampered`. The script also notes whether the browser fired a `securitypolicyviolation` event for the blocked `eval`, and it ignores events whose `isTrusted` is `false`, so a page script can't fake that confirmation. The flag is informational and never counts in the visitor's favor.

Widgets older than this release keep working against a new server, with the limits described in [widgets from earlier releases](./instrumentation.md#widgets-from-earlier-releases).

### Pages with an HTML injection bug

The instrumentation frame shares your page's origin, and once you set `CAP_SCRIPT_NONCE` the widget gives the frame's script your nonce. The widget runs whatever script the server in `data-cap-api-endpoint` sends. If an attacker can inject HTML into a page that sets `CAP_SCRIPT_NONCE`, they can add a `<cap-widget>` that points at their own server, and that server's script then runs with your page's origin and passes your policy. On that page, a bug that your policy would otherwise contain becomes cross-site scripting.

This only matters on pages that rely on a nonce-based policy to contain HTML injection. Without such a policy, injected HTML can already run script, and the widget adds nothing to it.

A separate case is the server itself. Without `CAP_ISOLATE`, the script from `data-cap-api-endpoint` runs with your page's origin, so whoever runs that server, or anyone who takes it over, can run script in your page. Set `CAP_ISOLATE` whenever the endpoint is a server you don't control.

On those pages, set `window.CAP_ISOLATE = true` in a script before the widget loads:

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_ISOLATE = true;
</script>
```

The widget then runs the frame without `allow-same-origin`, so its script gets an opaque origin and can't read or change your page, cookies or storage, whichever server sent it. It has to be set from JavaScript, since injected HTML can't run any and an attribute on the widget would be in the attacker's hands.

The check gives up what it reads from the page. It still runs the [automated browser checks](./instrumentation.md#automated-browser-detection) against its own frame, but it can't record interactions, a behavior trace or AI agent markers. The server accepts those solves with the `isolated_frame` risk flag on keys that only report these signals, and rejects them with `instr_isolated` on keys that block automated interactions, score behavior with blocking on, or block agents.

## Self-hosting the widget

The widget loads from jsDelivr by default, and so do the two WASM files its solver fetches. To serve all of it from your own domain:

1. Serve the script yourself, either by importing `cap-widget` through your bundler or from capd's [asset server](./capd/options.md#asset-server) at `/assets/widget.js`.
2. Point the solver at your copies of the WASM files before the widget solves anything:

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

With a bundler, set the two globals before `import "cap-widget"` runs. The URLs can point anywhere you host the files.
