# @cap.js/server

`@cap.js/server` is Cap's server-side library for creating and validating challenges. Install it using your preferred package manager:

::: code-group

```bash [bun]
bun add @cap.js/server
```

```bash [npm]
npm i @cap.js/server
```

```bash [pnpm]
pnpm i @cap.js/server
```

:::

## Getting started

The best way to use Cap is with **storage hooks** that connect to your database. Here's a simple example with SQLite:

```js
import Cap from "@cap.js/server";
import { Database } from "bun:sqlite";

const db = new Database("cap.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tokens (
    key TEXT PRIMARY KEY,
    expires INTEGER NOT NULL
  );
`);

const cap = new Cap({
  storage: {
    challenges: {
      store: async (token, challengeData) => {
        db.prepare(
          "INSERT OR REPLACE INTO challenges (token, data, expires) VALUES (?, ?, ?)"
        ).run(token, JSON.stringify(challengeData), challengeData.expires);
      },
      read: async (token) => {
        const row = db
          .prepare(
            "SELECT data, expires FROM challenges WHERE token = ? AND expires > ?"
          )
          .get(token, Date.now());

        return row
          ? { challenge: JSON.parse(row.data), expires: row.expires }
          : null;
      },
      delete: async (token) => {
        db.prepare("DELETE FROM challenges WHERE token = ?").run(token);
      },
      deleteExpired: async () => {
        db.prepare("DELETE FROM challenges WHERE expires <= ?").run(Date.now());
      },
    },
    tokens: {
      store: async (tokenKey, expires) => {
        db.prepare(
          "INSERT OR REPLACE INTO tokens (key, expires) VALUES (?, ?)"
        ).run(tokenKey, expires);
      },
      get: async (tokenKey) => {
        const row = db
          .prepare("SELECT expires FROM tokens WHERE key = ? AND expires > ?")
          .get(tokenKey, Date.now());

        return row ? row.expires : null;
      },
      delete: async (tokenKey) => {
        db.prepare("DELETE FROM tokens WHERE key = ?").run(tokenKey);
      },
      deleteExpired: async () => {
        db.prepare("DELETE FROM tokens WHERE expires <= ?").run(Date.now());
      },
    },
  },
});

export default cap;
```

Now, you can connect this to your backend to expose the routes needed for the widget:

::: code-group

```js [Elysia]
import { Elysia } from "elysia";
import cap from "...";

new Elysia()
  .post("/cap/challenge", async () => {
    return await cap.createChallenge();
  })
  .post("/cap/redeem", async ({ body, set }) => {
    const { token, solutions } = body;
    if (!token || !solutions) {
      set.status = 400;
      return { success: false };
    }
    return await cap.redeemChallenge({ token, solutions });
  })
  .listen(3000);
```

```js [Express]
import express from "express";
import cap from "...";

const app = express();
app.use(express.json());

app.post("/cap/challenge", async (req, res) => {
  res.json(await cap.createChallenge());
});

app.post("/cap/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000);
```

```js [Fastify]
import Fastify from "fastify";
import cap from "...";

const fastify = Fastify();

fastify.post("/cap/challenge", async (req, res) => {
  res.send(await cap.createChallenge());
});

fastify.post("/cap/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.code(400).send({ success: false });
  }
  res.send(await cap.redeemChallenge({ token, solutions }));
});

fastify.listen({ port: 3000 });
```

:::

In this example, the Cap API is at `/cap/` — set that in your widget as `data-cap-api-endpoint` ([see widget docs](./widget.md)).

When someone completes the CAPTCHA and sends the token back to your backend, you can validate the token and proceed with your logic.

```js
const { success } = await cap.validateToken("...");

if (!success) throw new Error("invalid cap token");

// ...your logic
```

## Methods and arguments

#### `new Cap({ ... })`

**Arguments**

```json
{
  // used for json keyval storage. storage hooks are recommended instead
  "tokens_store_path": ".data/tokensList.json",

  // disables all filesystem operations, usually used along editing the state. storage hooks are recommended instead
  "noFSState": false,

  "disableAutoCleanup": false,

  "storage": {
    "challenges": {
      "store": "async (token, challengeData) => {}",
      "read": "async (token) => {}",
      "delete": "async (token) => {}",
      "deleteExpired": "async () => {}"
    },
    "tokens": {
      "store": "async (tokenKey, expires) => {}",
      "get": "async (tokenKey) => {}",
      "delete": "async (tokenKey) => {}",
      "deleteExpired": "async () => {}"
    }
  },

  "state": {
    "challengesList": {},
    "tokensList": {}
  }
}
```

You can always access or set the options of the `Cap` class by accessing or modifying the `cap.config` object.

#### `await cap.createChallenge({ ... })`

**Arguments**

```json
{
  "challengeCount": 50,
  "challengeSize": 32,
  "challengeDifficulty": 4,
  "expiresMs": 600000
}
```

**Response:** `{ challenge, token, expires }`

#### `cap.redeemChallenge({ ... })`

```json
{
  token,
  solutions
}
```

**Response:** `{ success, token }`

#### `await cap.validateToken("...", { ... })`

**Arguments:**

```json
{
  "keepToken": false
}
```

**Response:** `{ success }`

#### `await cap.cleanup()`

Cleans up all expired challenges and tokens. This is usually done for you by default.
