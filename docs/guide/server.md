# @cap.js/server

`@cap.js/server` is Cap's server-side library. It helps you create and validate challenges for your users. Start by installing it using npm or bun:

```
npm i @cap.js/server
```

> [!NOTE]
> It is recommended to use at least Node.js 14 or Bun 1.0.0. You might experience multiple issues on older versions of these runtimes.    
> If you're using Glitch, make sure to set node 14 or higher in your `engines` field in `package.json`

## Example code

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

## Supported methods and arguments

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