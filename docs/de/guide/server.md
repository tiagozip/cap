---
head:
  - - meta
    - name: robots
      content: noindex, follow
---

# @cap.js/server

::: warning Legacy-Bibliothek — abgelöst durch [`capjs-core`](./capjs-core.md)
`@cap.js/server` ist nicht mehr die empfohlene Cap-Server-Bibliothek. Neue Projekte sollten [`capjs-core`](./capjs-core.md) verwenden: zustandslos (kein Dateisystem, keine In-Memory-Token-Liste, läuft auf Cloudflare Workers / Lambda / Edge), mit signierten JWTs, und intern die Basis von [Cap Standalone](./standalone/index.md). Siehe die [Migrationstabelle](./capjs-core.md#how-it-differs-from-cap-js-server).
:::

`@cap.js/server` ist Caps serverseitige Bibliothek zum Erzeugen und Validieren von Challenges. Installiere sie mit deinem bevorzugten Paketmanager:

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

## Erste Schritte

Du brauchst eine Datenbank, um Challenges und Tokens zu speichern. Hier ein Beispiel mit Buns SQL-Modul und einer Postgres-Datenbank:

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

Jetzt kannst du das an dein Backend anschließen, um die vom Widget benötigten Routen bereitzustellen:

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

In diesem Beispiel liegt die Cap-API unter `/cap/` — trag das im Widget als `data-cap-api-endpoint` ein ([siehe Widget-Doku](./widget.md)).

Wenn jemand das CAPTCHA abschließt und das Token an dein Backend zurückschickt, kannst du es validieren und mit deiner Logik fortfahren.

```js
const { success } = await cap.validateToken("...");

if (!success) throw new Error("invalid cap token");

// ...your logic
```

## Methoden und Argumente

#### `new Cap({ ... })`

**Argumente**

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

  // veraltet:

  // wird für JSON-Key-Value-Speicherung genutzt
  // "tokens_store_path": ".data/tokensList.json",

  // deaktiviert alle Dateisystem-Operationen, meist zusammen mit dem Bearbeiten des State genutzt
  // "noFSState": false,
}
```

Du kannst die Optionen der `Cap`-Klasse jederzeit über das Objekt `cap.config` lesen oder ändern.

#### `await cap.createChallenge({ ... })`

**Argumente**

```json
{
  "challengeCount": 50,
  "challengeSize": 32,
  "challengeDifficulty": 4,
  "expiresMs": 600000
}
```

**Antwort:** `{ challenge, token, expires }`

#### `cap.redeemChallenge({ ... })`

```json
{
  token,
  solutions
}
```

**Antwort:** `{ success, token }`

#### `await cap.validateToken("...", { ... })`

**Argumente:**

```json
{
  "keepToken": false
}
```

**Antwort:** `{ success }`

#### `await cap.cleanup()`

Räumt alle abgelaufenen Challenges und Tokens auf. Das passiert standardmäßig meist automatisch für dich.
