---
outline: [2, 3, 4]
---

# Widget

Cap's client-side widget handles requesting, solving and displaying challenges using a native web component and rust-flavoured WASM. It also includes the [programmatic mode](./programmatic).

## Installation

::: code-group

```sh [pnpm]
pnpm add cap-widget
```

```sh [npm]
npm i cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<!--

* you should pin a specific version in production to avoid breaking changes. alternatively, you can also use the standalone asset server
* `cdn.jsdelivr.net` is blocked in some jurisdictions, like some parts of China. if your website needs to be reachable from these jurisdictions, we recommend that you use npm.

-->

<script type="module" src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
```

:::

## Usage

The widget requires a `data-cap-api-endpoint` pointing at your Cap deployment. For Standalone instances, this is:

```
https://<your-instance>/<site-key>/
```

### Vanilla

```html
<form>
  <cap-widget id="cap" required data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

::: tip

When the widget lives inside a `<form>`, it automatically injects a hidden `cap-token` input, and the token is submitted alongside your other fields with no extra JavaScript needed.

:::

### React

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

::: tip

We recommend using React 19 or later as it improves custom element event handling

:::

### Vue

```vue
<script setup>
import "cap-widget";
</script>

<template>
  <form>
    <cap-widget
      data-cap-api-endpoint="https://<your-instance>/<site-key>/"
      @solve="(e) => console.log('token:', e.detail.token)"
      @progress="(e) => console.log(e.detail.progress)"
      @error="(e) => console.error(e.detail.message)"
    />
    <button type="submit">Submit</button>
  </form>
</template>
```

If you're getting an unknown-component warning, add this to your `vite.config.js`:

```js
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") },
      },
    }),
  ],
});
```

### Svelte 5

```svelte
<script>
  import "cap-widget";
</script>

<form>
  <cap-widget
    data-cap-api-endpoint="https://<your-instance>/<site-key>/"
    on:solve={(e) => console.log("token:", e.detail.token)}
    on:progress={(e) => console.log(e.detail.progress)}
    on:error={(e) => console.error(e.detail.message)}
  />
  <button type="submit">Submit</button>
</form>
```

### SolidJS

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve={(e) => console.log("token:", e.detail.token)}
        on:progress={(e) => console.log(e.detail.progress)}
        on:error={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Astro

```astro
---
// ContactForm.astro
---

<form>
  <cap-widget id="cap" data-cap-api-endpoint="https://<your-instance>/<site-key>/" />
  <button type="submit">Submit</button>
</form>

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

If you're rendering a React/Vue/Svelte component inside Astro, follow that framework's guide above and add `client:load` to the component.

### Preact

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Qwik

```tsx
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve$={(e: CustomEvent) => console.log("token:", e.detail.token)}
        on:progress$={(e: CustomEvent) => console.log(e.detail.progress)}
        on:error$={(e: CustomEvent) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
});
```

## Programmatic mode

If you don't want a visible widget, for example when protecting a background action like a post submission, use the [programmatic mode](./programmatic):

```js
import Cap from "cap-widget";

const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
});

const { token } = await cap.solve();
```

## Events

All events are dispatched as CustomEvent.

| Event      | When it fires                  | Detail                 |
| ---------- | ------------------------------ | ---------------------- |
| `solve`    | Challenge solved successfully  | `{ token: string }`    |
| `progress` | Progress update during solving | `{ progress: number }` |
| `error`    | An error occurred              | `{ message: string }`  |
| `reset`    | Widget reset to initial state  | `{}`                   |

## Options

You can also specify a custom fetch function with `window.CAP_CUSTOM_FETCH`:

```js
window.CAP_CUSTOM_FETCH = (url, params) => fetch(url, params);
```

You can also set a custom WASM url (for example the Standalone asset server's) with `window.CAP_CUSTOM_WASM_URL` or set a nonce for the CSS with `window.CAP_CSS_NONCE`.

To disable haptic feedback (vibrations on mobile devices), set `window.CAP_DISABLE_HAPTICS = true` globally or add the `data-cap-disable-haptics` attribute to individual widgets:

```js
window.CAP_DISABLE_HAPTICS = true;
```

```html
<cap-widget data-cap-disable-haptics data-cap-api-endpoint="..."></cap-widget>
```

Haptic feedback is automatically disabled in [programmatic mode](./programmatic) since there is no visible widget for the user to interact with

### Attributes

| Attribute                      | Description                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `data-cap-api-endpoint`        | **Required.** Your Cap endpoint: `https://<instance>/<site-key>/`             |
| `data-cap-worker-count`        | Number of solver workers (defaults to `navigator.hardwareConcurrency \|\| 8`) |
| `data-cap-hidden-field-name`   | Name of the hidden token input in a `<form>` (default: `cap-token`)           |
| `data-cap-troubleshooting-url` | Custom URL for the "Troubleshooting" link shown when a user is blocked        |
| `data-cap-disable-haptics`     | Disable haptic feedback (vibrations) on this widget                           |

#### i18n

All widget labels can be overridden with `data-cap-i18n-*` attributes. These default to English

```html
<cap-widget
  data-cap-api-endpoint="https://<your-instance>/<site-key>/"
  data-cap-i18n-initial-state="Verify you're human"
  data-cap-i18n-verifying-label="Verifying..."
  data-cap-i18n-solved-label="You're human"
  data-cap-i18n-error-label="Error"
  data-cap-i18n-troubleshooting-label="Troubleshooting"
  data-cap-i18n-wasm-disabled="Enable WASM for significantly faster solving"
  data-cap-i18n-verify-aria-label="Click to verify you're a human"
  data-cap-i18n-verifying-aria-label="Verifying, please wait"
  data-cap-i18n-verified-aria-label="Verified"
  data-cap-i18n-required-label="Please verify you're human"
  data-cap-i18n-error-aria-label="An error occurred, please try again"
></cap-widget>
```

### Styling

Override any of these CSS variables on the `cap-widget` element:

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
