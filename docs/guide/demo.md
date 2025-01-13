# Demo

**Note:** The docs demo might not work. Please download and use the code from the [demo folder in the repo](https://github.com/tiagorangel1/cap/tree/main/demo) instead — it includes all of the setup needed with an Express.js server.

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