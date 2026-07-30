---
head:
  - - meta
    - name: robots
      content: noindex, follow
---

# @cap.js/server

::: warning 旧版库——已被 [`capjs-core`](./capjs-core.md) 取代
`@cap.js/server` 已不再是推荐的 Cap 服务端库。新项目应使用 [`capjs-core`](./capjs-core.md)：它是无状态的（不依赖文件系统、没有内存令牌列表，可运行在 Cloudflare Workers / Lambda / 边缘环境），使用带签名的 JWT，也是 [Cap Standalone](./standalone/index.md) 内部所采用的库。参见[迁移对照表](./capjs-core.md#how-it-differs-from-cap-js-server)。
:::

`@cap.js/server` 是 Cap 用于创建和校验质询的服务端库。使用你偏好的包管理器安装：

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

## 快速上手

你需要一个数据库来存储质询和令牌。下面是使用 Bun 的 SQL 模块搭配 Postgres 数据库的示例：

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

现在，你可以将它接入你的后端，暴露验证组件所需的路由：

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

在这个示例中，Cap API 位于 `/cap/`——把它设置为验证组件的 `data-cap-api-endpoint`（[见验证组件文档](./widget.md)）。

当有人完成 CAPTCHA 并把令牌发回你的后端后，你就可以校验令牌并继续执行业务逻辑。

```js
const { success } = await cap.validateToken("...");

if (!success) throw new Error("invalid cap token");

// ...你的业务逻辑
```

## 方法与参数

#### `new Cap({ ... })`

**参数**

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

  // 已废弃：

  // 用于 JSON 键值存储
  // "tokens_store_path": ".data/tokensList.json",

  // 禁用所有文件系统操作，通常与直接修改 state 搭配使用
  // "noFSState": false,
}
```

你随时可以通过访问或修改 `cap.config` 对象来读取或设置 `Cap` 类的选项。

#### `await cap.createChallenge({ ... })`

**参数**

```json
{
  "challengeCount": 50,
  "challengeSize": 32,
  "challengeDifficulty": 4,
  "expiresMs": 600000
}
```

**响应：**`{ challenge, token, expires }`

#### `cap.redeemChallenge({ ... })`

```json
{
  token,
  solutions
}
```

**响应：**`{ success, token }`

#### `await cap.validateToken("...", { ... })`

**参数：**

```json
{
  "keepToken": false
}
```

**响应：**`{ success }`

#### `await cap.cleanup()`

清理所有已过期的质询和令牌。默认情况下会自动执行。
