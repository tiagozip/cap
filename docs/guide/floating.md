# Floating mode

Cap can automatically hide the CAPTCHA until a button is pressed. To use this, add the `data-cap-floating` attribute to your trigger with the query selector of the `cap-widget` element you want to use.

```html
<cap-widget
  id="floating"
  onsolve="console.log(`token: ${event.detail.token}`)"
  data-cap-api-endpoint="<api endpoint>"
></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">
  Trigger floating mode
</button>
```

You'll also need to import both the Cap library and the floating mode script from JSDelivr:

```html{2}
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget/cap-floating.min.js"></script> <!-- [!code ++] -->
```

Or from the standalone server:

```html
<script src="https://<server url>/assets/widget.js"></script>
<script src="https://<server url>/assets/floating.js"></script> <!-- [!code ++] -->
```

The following attributes are supported:

- `data-cap-floating`: The CSS selector of the `cap-widget` element you want to use.
- `data-cap-floating-position`: The position of the floating widget. Can be `top` or `bottom`.
- `data-cap-floating-offset`: The offset of the floating widget from the trigger element.