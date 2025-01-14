---
outline: deep
---

# Quickstart
[[toc]]

## Client-side

Start by adding it from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/@cap.js/widget"></script>
```

Next, add the `<cap-widget>` component to your HTML.

```html
<cap-widget id="cap" data-cap-api-endpoint="<your cap api endpoint>"></cap-widget>
```

**Note:** You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. In the server-side example we provided, it's set to `/api`, but you can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.

> [!NOTE]
> You'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute.
> In the server-side example we provided, it's set to `/api`, but you can change this by replacing every `app.post('/api/...', ...)` to `app.post('/<endpoint>/...', ...)`.


> [!TIP]
> The following attributes are supported:
> 
> * `data-cap-api-endpoint`: API endpoint (required)
> * `data-cap-worker-count`: Number of workers to use (defaults to `navigator.hardwareConcurrency || 8`)

Then, in your JavaScript, listen for the `solve` event to capture the token when generated:

```js{3}
const widget = document.querySelector("#cap");

widget.addEventListener("solve", function (e) { 
  const token = e.detail.token;
  
  // Handle the token as needed
});
```

Alternatively, you can use `onsolve=""` directly within the widget or wrap the widget in a `<form></form>` (where Cap will automatically submit the token alongside other form data).

## Server-side
Cap is fully self-hosted, so you'll need to start a server with the Cap API running at the same URL as specified in the `data-cap-api-endpoint` attribute. This is easy since we've already pre-made a library to help you generate and validate challenges for you.

Start by installing it using npm or bun:

```
npm i @cap.js/server
```

> [!NOTE]
> It is recommended to use at least Node.js 14 or Bun 1.0.0. You might experience multiple issues on older versions of these runtimes.

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
It should be pretty easy to replicate this code but with other frameworks such as Hono.


::: details Methods

The following methods are supported:

#### `new Cap({ ... })`
Creates a new Cap instance.

**Arguments**
```json
{
  tokens_store_path: ".data/tokensList.json",
  state: {
    challengesList: {},
    tokensList: {},
  },
}
```

> [!TIP]
> You can always access or set the options of the `Cap` class by accessing or modifying the `cap.config` object.

#### `cap.createChallenge({ ... })`
**Arguments**
```json
{
  challengeCount: 18,
  challengeSize: 32,
  challengeDifficulty: 4,
  expiresMs: 600000
}
```
**Output:** `{ challenge, expires }`

#### `cap.redeemChallenge({ ... })`
```json
{
  token,
  solutions
}
```

**Output:** `{ success, token }`

#### `await cap.validateToken("...", { ... })`
**Arguments:**
```json
{
  keepToken: false
}
```
**Output:** `{ success }`
:::

### Token Validation

Once the token is generated and captured, you can use it later to validate the user's identity. You can do this by calling `await cap.validateToken` in your server-side code:

```js
await cap.validateToken("...") // returns { success: Boolean }
```

Note that the token will immediately be deleted after this. To prevent this, use `await cap.validateToken("...", { keepToken: true })`.