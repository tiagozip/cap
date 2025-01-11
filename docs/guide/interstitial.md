# Interstitial mode

Interstitial mode is an alternative to the floating mode that'll show a dialog with the widget. It'll automatically hide the widget until the user clicks on the trigger element, and the widget will automatically start solving.

To use it, you'll need to call `await CapInterstitial()` from your JS.

```html
<script src="https://cdn.jsdelivr.net/gh/tiagorangel1/cap/src/js/min/cap.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/tiagorangel1/cap/src/js/min/cap-interstitial.min.js"></script>
```
```js
const token = await CapInterstitial();
console.log("Token:", token)
```