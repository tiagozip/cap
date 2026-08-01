---
head:
  - - meta
    - name: robots
      content: noindex, follow
---

# @cap.js/server

::: warning Bibliothèque historique — remplacée par [`capjs-core`](./capjs-core.md)
`@cap.js/server` n'est plus la bibliothèque serveur recommandée pour Cap. Les nouveaux projets devraient utiliser [`capjs-core`](./capjs-core.md), qui est sans état (pas de système de fichiers, pas de liste de jetons en mémoire, fonctionne sur Cloudflare Workers / Lambda / edge), utilise des JWT signés, et sur laquelle [Cap Standalone](./standalone/index.md) est bâti en interne. Voir le [tableau de migration](./capjs-core.md#how-it-differs-from-cap-js-server).
:::

`@cap.js/server` est la bibliothèque serveur de Cap pour créer et valider des défis. Installez-la avec votre gestionnaire de paquets préféré :

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

## Prise en main

Il vous faut une base de données pour stocker les défis et les jetons. Voici un exemple avec le module SQL de Bun et une base Postgres :

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

Vous pouvez maintenant brancher cela à votre backend pour exposer les routes dont le widget a besoin :

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

Dans cet exemple, l'API Cap se trouve sur `/cap/` — indiquez-le dans votre widget via `data-cap-api-endpoint` ([voir la doc du widget](./widget.md)).

Quand quelqu'un termine le CAPTCHA et renvoie le jeton à votre backend, vous pouvez le valider puis poursuivre votre logique.

```js
const { success } = await cap.validateToken("...");

if (!success) throw new Error("invalid cap token");

// ...your logic
```

## Méthodes et arguments

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

  // obsolète :

  // utilisé pour le stockage clé-valeur en JSON
  // "tokens_store_path": ".data/tokensList.json",

  // désactive toutes les opérations sur le système de fichiers, généralement utilisé avec la modification de l'état
  // "noFSState": false,
}
```

Vous pouvez à tout moment lire ou modifier les options de la classe `Cap` via l'objet `cap.config`.

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

**Réponse :** `{ challenge, token, expires }`

#### `cap.redeemChallenge({ ... })`

```json
{
  token,
  solutions
}
```

**Réponse :** `{ success, token }`

#### `await cap.validateToken("...", { ... })`

**Arguments :**

```json
{
  "keepToken": false
}
```

**Réponse :** `{ success }`

#### `await cap.cleanup()`

Nettoie tous les défis et jetons expirés. En général, cela est fait automatiquement pour vous.
