# Options

## CORS

You can change the default CORS settings for redeeming and generating challenges by setting the `CORS_ORIGIN` environment variable when running the server. This defaults to `*`, which allows all origins. You can add multiple origins by separating them with commas, like `domain1.tld,domain2.tld,...`.

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

And by setting `window.CAP_CUSTOM_WASM_URL` to the path of the `cap_wasm.js` file, like this:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm.js";
```

By default, these fetch from `process.env.CACHE_HOST` (which defaults to `https://cdn.jsdelivr.net`). You can change this by setting the `CACHE_HOST` env variable when running the server.

## Rate-limiting

By default, Standalone will use Elysia's built-in `server.requestIP` function to identify a client's IP for ratelimiting. This might not be correct if you're using something like Cloudflare behind your service.

If so, you can change the IP extraction logic to simply read from a header set in `RATELIMIT_IP_HEADER` in your env. For example, if you were using Cloudflare, you might set `RATELIMIT_IP_HEADER` to `cf-connecting-ip`. On most setups, this is `x-forwarded-for`.

The `/siteverify` endpoint is intended for server-to-server use, so each request checks if your key's secret is valid. If it is, the request is allowed. If not, the request is denied and the client's IP is temporarily blocked for a few hundred milliseconds. This prevents database strain without affecting legitimate requests.

If you're interested in an option to fully disable ratelimiting, let us know using GitHub issues.

## Custom data path

If you would like the data to be stored in a custom path inside the container, you can set the `DATA_PATH` environment variable to the desired path. Note that this only works in Standalone 2.0.9 or above.

## Custom DB connectors

Cap Standalone uses SQLite as the default database for storing keys and challenges. If you'd like to use a different database, you can set the `DB_CONNECTOR` environment variable to the name of the database connector you want to use.

The current accepted values are:

- `bun-sqlite` (default): Bun's built-in SQLite support

- `turso` (experimental): Uses [turso](https://turso.tech/) instead of SQLite. 
  
  Both can be exchanged at any time and data won't be lost, however Turso is experimental and doesn't support two or more processes using the same database at the same time (at least at the time of writing).