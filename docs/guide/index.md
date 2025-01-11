---
outline: deep
---

# Geting Started
Cap is a library designed for safeguarding against spam and abuse by utilizing a PoW mechanism using both an open-source client-side widget that you can seamlessly integrate with your website and a server-side verification process which typically involves only a few lines of code.

## Adding the Cap widget

Cap is built to be straightforward and requires no API tokens for setup. Start by importing the Cap library:

```html
<script src="https://cdn.jsdelivr.net/gh/tiagorangel1/cap/src/js/min/cap.min.js"></script>
```

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget id="cap" data-api-endpoint="https://trycap.glitch.me/api/"></cap-widget>
```

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js

const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) { 
  const token = e.detail.token;
  
  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data).


## Server-Side Validation

Once you have the token, verify it server-side with a simple POST request:

```http
POST <api-endpoint>/validate
Content-Type: application/json

{
  "token": "xxxxxxxxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

The server response will confirm the validity and immediately invalidate the token:

```json
{
  "success": true
}
```