---
description: "Invisible mode for Cap: call new Cap() and solve() to run the open-source CAPTCHA from your own JavaScript, with proof-of-work and no visible widget."
---

# Invisible

Invisible mode solves a challenge from your own code, with nothing shown on the page. It suits actions that have no form, like a like button or a background request.

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://cap.example.com/<site-key>/" });
const { token } = await cap.solve();
```

With the CDN script, `Cap` is a global and needs no import.

## API

### `new Cap(config, element?)`

`config.apiEndpoint` is required unless you set [`CAP_CUSTOM_FETCH`](./widget.md#options). Any other key is set as an attribute on the widget, so the [widget attributes](./widget.md#attributes) work here too:

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

Without `element`, Cap creates a hidden `<cap-widget>` with haptics off. A hidden widget doesn't fetch or solve anything ahead of time, so all the work happens when you call `solve()`. Pass an existing widget to drive that one.

### `cap.solve()`

Fetches and solves a challenge. Resolves to `{ success, token }`.

A failure fires an `error` event and rejects the promise with an `Error` whose `code` is one of the [error codes](./error-codes.md), such as `instr_csp_blocked` for a [blocked frame](./widget.md#content-security-policy):

```js
try {
  const { token } = await cap.solve();
} catch (err) {
  console.error(err.code, err.message);
}
```

A call made while a solve is already running resolves to `undefined`.

### `cap.token`

The token from the last solve, or `null`.

### `cap.reset()`

Clears the token.

### `cap.addEventListener(type, listener)`

Listens for the widget's [events](./widget.md#events):

```js
cap.addEventListener("progress", (e) => {
  console.log(`${e.detail.progress}%`);
});
```

## Keys with behavior scoring

Invisible solves have no click on a widget. On keys that [score behavior](./instrumentation.md#behavior-scoring), their verdict is `no_interaction`, so they fail on keys that block and require an interaction. In the core library, set `requireInteraction: false` in the `behavior` policy for those routes.
