# @cap.js/widget

> [!NOTE]  
> **Requirements:** All modern browsers should be supported, but the build script specifically targets the last 10 versions of Chrome, Firefox, Safari and Edge.

`@cap.js/widget` is Cap's client-side library. It includes the `cap-widget` web component, the invisible mode and the Captcha solver. First, add it to your client-side code:

::: code-group

```html [jsdelivr]
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
```

```html [unpkg]
<script src="https://unpkg.com/@cap.js/widget"></script>
```
:::

You can now use the `<cap-widget>` component in your HTML.

```html
<cap-widget
  id="cap"
  data-cap-api-endpoint="<your cap api endpoint>"
></cap-widget>
```

> [!NOTE]
> You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute.
> In the server-side example we provided, it's set to `/api`, but you can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.

> [!TIP]
> The following attributes are supported:
>
> - `data-cap-api-endpoint`: API endpoint (required)
> - `data-cap-worker-count`: Number of workers to use (defaults to `navigator.hardwareConcurrency || 8`)

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) {
  const token = e.detail.token;

  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data).

## Compatibility version

Use this script instead if you want compatibility with more browsers but a slightly bigger code size:

```html
<script src="https://cdnjs.cloudflare.com/polyfill/v3/polyfill.min.js?features=default,fetch,CustomEvent,TextEncoder,Element,CustomElements,ShadowDOM&flags=gated"></script>
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget/cap.compat.min.js"></script>
```

## Supported events

The following custom events are supported:

- `solve`: Triggered when the token is generated.
- `error`: Triggered when an error occurs.
- `reset`: Triggered when the widget is reset.
- `progress`: Triggered when the there's a progress update while in verification.

## Custom fetch
You can override the default fetch implementation by setting `window.CAP_CUSTOM_FETCH` to a custom function. This function will receive the URL and options as arguments and should return a promise that resolves to the response.

```js
window.CAP_CUSTOM_FETCH = function (url, options) {
  // Custom fetch implementation
  return fetch(url, options);
};
```