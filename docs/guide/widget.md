# @cap.js/widget

[![](https://data.jsdelivr.com/v1/package/npm/@cap.js/widget/badge?style=rounded)](https://www.jsdelivr.com/package/npm/@cap.js/widget)

`@cap.js/widget` is Cap's client-side library. It includes the `cap-widget` web component, the invisible mode and the CAPTCHA solver. First, add it to your client-side code:

::: code-group

```html[jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>

<!-- we're using the latest version of the library here for simplicity, but you should optimally pin a specific version to avoid breaking changes in the future. -->
```

```html[unpkg]
<script src="https://unpkg.com/@cap.js/widget"></script>

<!-- we're using the latest version of the library here for simplicity, but you should optimally pin a specific version to avoid breaking changes in the future. -->
```

```js[bundler]
// npm:  npm i @cap.js/widget
// pnpm: pnpm install @cap.js/widget
// bun:  bun add @cap.js/widget

import Cap from '@cap.js/widget';

// ...
```

```html[standalone server]
<script>
  window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm.js";
</script>
<script src="https://<server url>/assets/widget.js"></script>
```
:::

You can now use the `<cap-widget>` component in your HTML.

```html
<cap-widget id="cap" data-cap-api-endpoint="<your cap endpoint>"></cap-widget>
```

**Note:** You'll need to start a server with an API exposing the Cap methods running at the same URL as specified in the `data-cap-api-endpoint` attribute.

The following attributes are supported:

- `data-cap-api-endpoint`: API endpoint (required if not using custom fetch)
- `data-cap-worker-count`: Number of workers to use (defaults to `navigator.hardwareConcurrency || 8`)
- `onsolve=""`: Event listener for the `solve` event
- [i18n attributes](#i18n)

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) {
  const token = e.detail.token;

  // handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data. for this, it'll create a hidden field with name set to its `data-cap-hidden-field-name` attribute or `cap-token`).

## Invisible mode
You can use `new Cap({ ... })` in your client-side JavaScript to create a new Cap instance and use the `solve()` method to solve the challenge. This is helpful for situations where you don't want the Cap widget to be visible but still want security, e.g. on a social media app when posting something.

```js
import Cap from '@cap.js/widget';

const cap = new Cap({
  apiEndpoint: '/api/cap/'
});

const token = await cap.solve();
```

## Supported events

The following custom events are supported:

- `solve`: Triggered when the token is generated.
- `error`: Triggered when an error occurs.
- `reset`: Triggered when the widget is reset.
- `progress`: Triggered when there's a progress update while in verification.

## i18n

You can change the text on each label of the widget by setting the `data-cap-i18n-*` attribute, like this:

```html
<cap-widget
  id="cap"
  data-cap-api-endpoint="<your cap endpoint>"
  data-cap-i18n-verifying-label="Verifying..."
  data-cap-i18n-initial-state="I'm a human"
  data-cap-i18n-solved-label="I'm a human"
  data-cap-i18n-error-label="Error"
  data-cap-i18n-wasm-disabled="Enable WASM for significantly faster solving"
></cap-widget>
```

`verify-aria-label`, `verifying-aria-label`, `verified-aria-label`, `error-aria-label` are also supported for screen readers.

## Customizing the widget

### fetch function

You can override the default browser fetch implementation by setting `window.CAP_CUSTOM_FETCH` to a custom function. This function will receive the URL and options as arguments and should return a promise that resolves to the response.

```js
window.CAP_CUSTOM_FETCH = function (url, options) {
  // … add your custom fetch implementation

  return fetch(url, options);
};
```

## WASM URL

You can override the default WASM URL by setting `window.CAP_CUSTOM_WASM_URL` to a custom URL. This URL will be used to load the WASM module. This defaults to `https://cdn.jsdelivr.net/npm/@cap.js/wasm@0.0.4/browser/cap_wasm.min.js`

## Customizing

You can fully change how the widget looks by setting various CSS variables on the `cap-widget` element. The following CSS variables are supported:

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
  --cap-font: system, -apple-system, "BlinkMacSystemFont", ".SFNSText-Regular", "San Francisco",
    "Roboto", "Segoe UI", "Helvetica Neue", "Lucida Grande", "Ubuntu", "arial", sans-serif;
  --cap-spinner-color: #000;
  --cap-spinner-background-color: #eee;
  --cap-spinner-thickness: 5px;
  --cap-checkmark: url("data:image/svg+xml,...");
  --cap-error-cross: url("data:image/svg+xml,...");
}
```

<small>Note: you _can_ technically hide the "Cap" label, but we kindly ask you to leave it visible. It's unobtrusive, doesn't track users, lightweight, and helps Cap grow.</small>

## Types

Cap's widget is fully typed. You can find the type definitions in the `cap.d.ts` file.