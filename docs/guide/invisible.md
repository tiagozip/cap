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

`config.apiEndpoint` is required. Any other key is set as an attribute on the widget, so the [widget attributes](./widget.md#attributes) work here too:

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

Without `element`, Cap creates a hidden `<cap-widget>` with haptics off. Pass an existing widget to drive that one.

### `cap.solve()`

Fetches and solves a challenge. Resolves to `{ success, token }`.

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
