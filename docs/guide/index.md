---
outline: deep
---

# Geting Started
Cap is a library designed for safeguarding against spam and abuse by utilizing a PoW mechanism using both an open-source client-side widget that you can seamlessly integrate with your website and a server-side verification process which typically involves only a few lines of code.

## Adding the Cap widget

### Server-side
Cap is fully self-hosted, so you'll need to start a server with the Cap API running at the same URL as specified in the `cap-api-endpoint` attribute. This is easy since we've already pre-made a library to help you generate and validate challenges for you.

Start by installing it using npm or bun:

```
npm i @cap.js/server
```

Now, you'll need to change your server code to add the routes that Cap needs to work. Here's an example with Express.js:

```js
const express = require('express');
const Cap = require('@cap.js/server');

const app = express();
app.use(express.json());

const cap = new Cap({
  tokens_store_path: '.data/tokensList.json' // make sure this file has already been created and added to your gitignore
});

app.post('/api/challenge', (req, res) => {
  res.json(cap.createChallenge());
});

app.post('/api/redeem', async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000, () => {
  console.log('Listening on port 3000');
})
```

It should be easy to adapt this to work with other frameworks such as Hono.

### Client-side

Cap's widget is really easy to add. Start by adding it from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
```

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget id="cap" cap-api-endpoint="<your cap api endpoint>"></cap-widget>
```

**Note:** You'll need to start a server with the Cap API running at the same URL as specified in the `cap-api-endpoint` attribute. In the server-side example we provided, the `cap-api-endpoint` attribute is set to `/api`. You can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) { 
  const token = e.detail.token;
  
  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data).


## Server-Side Validation

Once the token is generated and captured, you can use it later to validate the user's identity. This is typically done by sending the token to a server-side endpoint that uses the Cap API for validation.

To do this, you'll only need to call `await cap.validateToken("...")`. This will return `{ success: Boolean }`. Note that the token will immediately be deleted after this. To prevent this, use `await cap.validateToken("...", { keepToken: true })`.