# @cap.js/server

`@cap.js/server` is Cap's server-side library. It helps you create and validate challenges for your users. Start by installing it using bun (recommended), npm, or pnpm:

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

## Example code

::: code-group

```js [Elysia]
import { Elysia } from "elysia";
import Cap from "@cap.js/server";

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

new Elysia()
  .post("/api/challenge", () => {
    return cap.createChallenge();
  })

  .post("/api/redeem", async ({ body, set }) => {
    const { token, solutions } = body;

    if (!token || !solutions) {
      set.status = 400;
      return { success: false };
    }

    return await cap.redeemChallenge({ token, solutions });
  })
  .listen(3000);

console.log(`🦊 Elysia is running at http://localhost:3000`);
```

```js [Fastify]
import Fastify from "fastify";
import Cap from "@cap.js/server";

const fastify = Fastify();
const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

fastify.post("/api/challenge", (req, res) => {
  res.send(cap.createChallenge());
});

fastify.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.code(400).send({ success: false });
  }

  res.send(await cap.redeemChallenge({ token, solutions }));
});

fastify.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
  console.log("Server is running on http://localhost:3000");
});
```

```js [Bun.serve]
import Cap from "@cap.js/server";

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

Bun.serve({
  port: 3000,
  routes: {
    "/api/challenge": {
      POST: () => {
        return Response.json(cap.createChallenge());
      },
    },
    "/api/redeem": {
      POST: async (req) => {
        const body = await req.json();
        const { token, solutions } = body;

        if (!token || !solutions) {
          return Response.json({ success: false }, { status: 400 });
        }

        return Response.json(await cap.redeemChallenge({ token, solutions }));
      },
    },
  },
});

console.log(`Server running at http://localhost:3000`);
```

```js [hono]
import { Hono } from "hono";
import Cap from "@cap.js/server";

const app = new Hono();
const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

app.post("/api/challenge", (c) => {
  return c.json(cap.createChallenge());
});

app.post("/api/redeem", async (c) => {
  const { token, solutions } = await c.req.json();
  if (!token || !solutions) {
    return c.json({ success: false }, 400);
  }

  return c.json(await cap.redeemChallenge({ token, solutions }));
});

export default {
  port: 3000,
  fetch: app.fetch,
};
```

```js [Express]
import express from "express";
import Cap from "@cap.js/server";

const app = express();
app.use(express.json());

const cap = new Cap({
  tokens_store_path: ".data/tokensList.json",
});

app.post("/api/challenge", (req, res) => {
  res.json(cap.createChallenge());
});

app.post("/api/redeem", async (req, res) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
});

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

:::

Note that these are the simplest examples possible. You should adapt them to your needs. Usually, you'll want to:

- Use an actual database such as SQLite or Redis for storing tokens and challenges — in this example, we're using a very simple JSON db + memory access.

- Some kind of actual ratelimiting.

Both of these are done for you in the [Standalone server](./standalone/index.md), but here's also [an example with everything for a simple Elysia app](#full-example-with-elysia).

Then, you can verify the CAPTCHA tokens on your server by calling the `await cap.validateToken("<token>")` method. Example:

```js
const { success } = await cap.validateToken("9363220f..."); // [!code highlight]

if (success) {
  console.log("Valid token");
} else {
  console.log("Invalid token");
}
```

## Supported methods and arguments

The following methods are supported:

#### `new Cap({ ... })`

Creates a new Cap instance.

**Arguments**

```json
{
  "tokens_store_path": ".data/tokensList.json",
  "noFSState": false,
  "state": {
    "challengesList": {},
    "tokensList": {}
  }
}
```

You can always access or set the options of the `Cap` class by accessing or modifying the `cap.config` object.

#### `cap.createChallenge({ ... })`

**Arguments**

```json
{
  "challengeCount": 50,
  "challengeSize": 32,
  "challengeDifficulty": 4,
  "expiresMs": 600000
}
```

**Response:** `{ challenge, expires }`

> if `noFSState` is set to `true`, the state will be stored in memory only. You can use this together with setting `config.state` to use a custom db such as redis for storing tokens. Added by [#16](https://github.com/tiagorangel1/cap/pull/16)

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

## Full example with Elysia

```js
import { Elysia, t } from "elysia";
import Cap from "@cap.js/server";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "elysia-rate-limit";
import { Database } from "bun:sqlite";

// make sure this is a real file!
const db = new Database("./.data/cap.sqlite");

db.query(
  `create table if not exists challenges (
    token string not null,
    data string not null,
    expires integer not null,
    primary key (token)
  )`
).run();

db.query(
  `create table if not exists tokens (
    token string not null,
    expires integer not null,
    primary key (token)
  )`
).run();

const insertChallengeQuery = db.query(`
  INSERT INTO challenges (token, data, expires)
  VALUES (?, ?, ?)
`);
const getChallengeQuery = db.query(`
  SELECT * FROM challenges WHERE token = ?
`);
const deleteChallengeQuery = db.query(`
  DELETE FROM challenges WHERE token = ?
`);

const insertTokenQuery = db.query(`
  INSERT INTO tokens (token, expires)
  VALUES (?, ?)
`);
const getTokenQuery = db.query(`
  SELECT * FROM tokens WHERE token = ?
`);
const deleteTokenQuery = db.query(`
  DELETE FROM tokens WHERE token = ?
`);

const challengeCount = 50;

export const capServer = new Elysia({
  prefix: "/cap",
})
  .use(
    rateLimit({
      scoping: "scoped",
      max: 45,
      duration: 5_000,
    })
  )
  .use(
    cors({
      origin: ["http://localhost:3000", "..."],
      methods: ["POST"],
    })
  )
  .post("/challenge", () => {
    const cap = new Cap({
      noFSState: true,
    });

    const challenge = cap.createChallenge({
      challengeCount,
    });

    insertChallengeQuery.run(
      challenge.token,
      Object.values(challenge.challenge).join(","),
      challenge.expires
    );

    return challenge;
  })
  .post(
    "/redeem",
    async ({ body, set }) => {
      const challenge = getChallengeQuery.get(body.token);

      if (!challenge) {
        set.status = 404;
        return { error: "Challenge not found" };
      }

      try {
        deleteChallengeQuery.run(body.token);
      } catch (e) {
        set.status = 404;
        return { error: "Challenge not found or already redeemed/expired" };
      }

      const cap = new Cap({
        noFSState: true,
        state: {
          challengesList: {
            [challenge.token]: {
              challenge: {
                c: challenge.data.split(",")[0],
                s: challenge.data.split(",")[1],
                d: challenge.data.split(",")[2],
              },
              expires: challenge.expires,
            },
          },
        },
      });

      const { success, token, expires } = await cap.redeemChallenge(body);

      if (!success) {
        set.status = 403;
        return { error: "Invalid solution" };
      }

      insertTokenQuery.run(token, expires);

      return {
        success: true,
        token,
        expires,
      };
    },
    {
      body: t.Object({
        token: t.String(),
        solutions: t.Array(t.Number()),
      }),
    }
  );

export const validateToken = async (_token) => {
  const token = getTokenQuery.get(_token);

  if (!token) {
    return { error: "Token not found" };
  }

  if (token.expires < Math.floor(Date.now() / 1000)) {
    deleteTokenQuery.run(_token);
    return { error: "Token expired" };
  }

  deleteTokenQuery.run(_token);
  return { success: true };
};

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  
  db.query(`DELETE FROM challenges WHERE expires < ?`).run(now);
  
  db.query(`DELETE FROM tokens WHERE expires < ?`).run(now);
}, 60000);
```
