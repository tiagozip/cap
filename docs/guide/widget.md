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

Point `data-cap-api-endpoint` at your server. For Standalone, that's `https://<instance>/<site-key>/`.

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

## Events

Each event is a `CustomEvent`.

| Event | Fires when | `detail` |
| --- | --- | --- |
| `solve` | The challenge is solved | `{ token }` |
| `progress` | Solving progresses | `{ progress }`, from 0 to 100 |
| `error` | Something fails | `{ message, code }` |
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

The keys are `initial-state`, `verifying-label`, `solved-label`, `error-label`, `required-label`, `troubleshooting-label`, `wasm-disabled`, and the screen reader labels `group-aria-label`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label` and `error-aria-label`.

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
| `CAP_CUSTOM_WASM_URL` | URL of `cap_wasm_bg.wasm`. |
| `CAP_CUSTOM_HASHWX_URL` | URL of `hashwx.wasm`. |
| `CAP_LANG` | Forces a [language](#languages) on every widget. |
| `CAP_DISABLE_HAPTICS` | Turns off vibration on every widget. |

## Self-hosting the widget

The widget loads from jsDelivr by default, and so do the two WASM files its solver fetches. To serve all of it from your own domain:

1. Serve the script yourself, either by importing `cap-widget` through your bundler or from Standalone's [asset server](./standalone/options.md#asset-server) at `/assets/widget.js`.
2. Point the solver at your copies of the WASM files before the widget solves anything:

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

With a bundler, set the two globals before `import "cap-widget"` runs. The URLs can point anywhere you host the files.
