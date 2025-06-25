# Options

## CORS

You can change the default CORS settings for redeeming and generating challenges by setting the `CORS_ORIGIN` environment variable when running the server. This defaults to `*`, which allows all origins.

## Asset server

The asset server is disabled by default. You can enable it by setting the `ENABLE_ASSETS_SERVER` environment variable to `true`. This will serve the assets from the `/assets` endpoint.

Then, make sure to set `WIDGET_VERSION` and `WASM_VERSION` to the correct version of the widget and WASM files you want to serve. This defaults to `latest`, which will serve the latest version of the widget and WASM files, although these are not recommended in production as they might serve breaking changes.

Your assets will be served from the following paths:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/cap_wasm.js`

You can use these in your app by setting the widget's script source to the appropriate path, like this:

```html
<script src="https://<server url>/assets/widget.js"></script>
```

For the floating mode, use:

```html
<script src="https://<server url>/assets/floating.js"></script>
```

And by setting `window.CAP_CUSTOM_WASM_URL` to the path of the `cap_wasm_bg.wasm` file, like this:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
```

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server.
