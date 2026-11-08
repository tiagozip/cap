---
description: "Floating mode for Cap's widget hides the open-source CAPTCHA until a button is pressed, then runs proof-of-work on demand. Set it up with one data attribute."
---

# Floating mode

Floating mode keeps the widget hidden until someone presses a button. The widget then appears next to the button, solves, hides again, and clicks the button a second time, so a submit button goes on to submit the form with the token in it.

Load the floating script after the widget:

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>
```

From capd's [asset server](./capd/options.md#asset-server), the floating script is at `/assets/floating.js`.

Then point a button at a widget with a CSS selector:

```html
<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

| Attribute | What it does |
| --- | --- |
| `data-cap-floating` | Selector of the widget to show. |
| `data-cap-floating-position` | `top` or `bottom` of the button. Defaults to `top`. |
| `data-cap-floating-offset` | Gap between the button and the widget, in pixels. Defaults to `8`. |

After a solve, the button also carries the token in `data-cap-token`.

The widget starts solving as soon as it appears, without a click on it. On keys that [score behavior](./instrumentation.md#behavior-scoring) and require an interaction, floating solves fail with `behavior_no_interaction`, the same as [invisible](./invisible.md#keys-with-behavior-scoring) ones.
