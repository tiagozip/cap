# Floating mode

Cap can automatically hide the captcha until the form is submitted. To use this feature, add the `data-cap-floating` attribute to the Cap widget with the query selector of the `cap-widget` element you want to use.

```html
<cap-widget id="floating" onsolve="alert(`Verification token: ${event.detail.token}`)" data-api-endpoint="<api endpoint>"></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">Trigger floating mode</button>
```

You'll also need to import both the Cap library and the floating mode script from JSDelivr:
```html{2}
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget/cap-floating.min.js"></script>
```

> [!NOTE]
> You'll not need to re-import the main Cap library if you've already done it.

The following attributes are supported:

- `data-cap-floating`: The query selector of the `cap-widget` element you want to use.
- `data-cap-floating-position`: The position of the floating widget. Can be `top` or `bottom`.
- `data-cap-floating-offset`: The offset of the floating widget from the trigger element.