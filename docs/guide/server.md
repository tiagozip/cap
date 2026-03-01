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

You'll need a database to store challenges and tokens. Here's an example using Bun's SQL module and a Postgres DB:

```js
import Cap from "@cap.js/server";
import { SQL } from "bun";

const db = new SQL(`postgres://user:password@localhost:5432/dbname`);

await db`
  CREATE TABLE IF NOT EXISTS challenges (
    token TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    expires BIGINT NOT NULL
  );
`;

await db`
  CREATE TABLE IF NOT EXISTS tokens (
    key TEXT PRIMARY KEY,
    expires BIGINT NOT NULL
  );
`;

const cap = new Cap({
  storage: {
    challenges: {
      store: async (token, challengeData) => {
        await db`
          INSERT INTO challenges (token, data, expires)
          VALUES (${token}, ${challengeData}, ${challengeData.expires})
          ON CONFLICT (token)
          DO UPDATE SET
            data = EXCLUDED.data,
            expires = EXCLUDED.expires
        `;
      },

      read: async (token) => {
        const [row] = await db`
          SELECT data, expires
          FROM challenges
          WHERE token = ${token}
            AND expires > ${Date.now()}
          LIMIT 1
        `;

        return row ? { challenge: row.data, expires: Number(row.expires) } : null;
      },

      delete: async (token) => {
        await db`
          DELETE FROM challenges
          WHERE token = ${token}
        `;
      },

      deleteExpired: async () => {
        await db`
          DELETE FROM challenges
          WHERE expires <= ${Date.now()}
        `;
      },
    },

    tokens: {
      store: async (tokenKey, expires) => {
        await db`
          INSERT INTO tokens (key, expires)
          VALUES (${tokenKey}, ${expires})
          ON CONFLICT (key)
          DO UPDATE SET
            expires = EXCLUDED.expires
        `;
      },

      get: async (tokenKey) => {
        const [row] = await db`
          SELECT expires
          FROM tokens
          WHERE key = ${tokenKey}
            AND expires > ${Date.now()}
          LIMIT 1
        `;

        return row ? Number(row.expires) : null;
      },

      delete: async (tokenKey) => {
        await db`
          DELETE FROM tokens
          WHERE key = ${tokenKey}
        `;
      },

      deleteExpired: async () => {
        await db`
          DELETE FROM tokens
          WHERE expires <= ${Date.now()}
        `;
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
import cap from "./cap.js";

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
import cap from "./cap.js";

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
import cap from "../cap.js";

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

  // deprecated:

  // used for json keyval storage
  // "tokens_store_path": ".data/tokensList.json",

  // disables all filesystem operations, usually used along editing the state
  // "noFSState": false,
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
