# Floating mode

Cap can automatically hide the captcha until the form is submitted. To use this feature, add the `data-cap-floating` attribute to the Cap widget with the query selector of the `cap-widget` element you want to use.

```html
<cap-widget id="floating" data-api-endpoint="https://<your website url>/api/"></cap-widget>
<button data-cap-floating="#floating" onclick="console.log('solved')" data-cap-floating-position="bottom"> Trigger floating mode</button>
```

You'll also need to import both the Cap library and the floating mode script from JSDelivr:
```html
<script src="https://cdn.jsdelivr.net/gh/tiagorangel1/cap/lib/cap.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/tiagorangel1/cap/lib/cap-floating.min.js"></script>
```

The following attributes are supported:

- `data-cap-floating`: The query selector of the `cap-widget` element you want to use.
- `data-cap-floating-position`: The position of the floating widget. Can be `top` or `bottom`.
- `data-cap-floating-offset`: The offset of the floating widget from the trigger element.