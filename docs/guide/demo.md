# Demo

**Note:** Please note that the demo implementation is still experimental! Don't consider it to be representative of the stability or behavior of Cap overall.

### Normal button:

<Demo />

```html
<cap-widget onsolve="alert(`Verification token: ${event.detail.token}`)"></cap-widget>
```

### Floating button:

<Demo-floating />

```html
<cap-widget id="floating" onsolve="alert(`Verification token: ${event.detail.token}`)"></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-offset="8" data-cap-floating-position="bottom" class="demo-button">Trigger Floating</button>
```