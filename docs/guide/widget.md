# @cap.js/widget

> [!NOTE]
> **Requirements:** All modern browsers should be supported, but the build script specifically targets the last 10 versions of Chrome, Firefox, Safari and Edge.


`@cap.js/widget` is Cap's client-side library. It includes the `cap-widget` web component, the invisible mode and the Captcha solver. It is recommended to use unpkg to install it:

```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
```

You can now use the `<cap-widget>` component in your HTML.

```html
<cap-widget id="cap" data-cap-api-endpoint="<your cap api endpoint>"></cap-widget>
```

> [!NOTE]
> You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute.
> In the server-side example we provided, it's set to `/api`, but you can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.

> [!TIP]
> The following attributes are supported:
> 
> * `data-cap-api-endpoint`: API endpoint (required)
> * `data-cap-worker-count`: Number of workers to use (defaults to `navigator.hardwareConcurrency || 8`)

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) { 
  const token = e.detail.token;
  
  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data).

## Supported events
The following custom events are supported: 

- `solve`: Triggered when the token is generated.
- `error`: Triggered when an error occurs.
- `reset`: Triggered when the widget is reset.
- `progress`: Triggered when the there's a progress update while in verification.

## Invisible mode
For docs on how to use the invisible mode, see ["Invisible mode"](invisible.md).

## Floating mode
For docs on how to use the floating mode, see ["Floating mode"](floating.md).