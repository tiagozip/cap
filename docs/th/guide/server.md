---
head:
  - - meta
    - name: robots
      content: noindex, follow
---

# @cap.js/server

::: warning ไลบรารีรุ่นเก่า — ถูกแทนที่ด้วย [`capjs-core`](./capjs-core.md)
`@cap.js/server` ไม่ใช่ไลบรารีฝั่งเซิร์ฟเวอร์ที่เราแนะนำอีกต่อไป โปรเจกต์ใหม่ควรใช้ [`capjs-core`](./capjs-core.md) ซึ่งไร้สถานะ (ไม่ใช้ระบบไฟล์ ไม่มีรายการ token ในหน่วยความจำ ใช้ได้บน Cloudflare Workers / Lambda / edge) ใช้ JWT ที่ลงลายเซ็น และเป็นสิ่งที่ [Cap Standalone](./standalone/index.md) ใช้อยู่ภายใน ดู[ตารางเทียบสำหรับการย้าย](./capjs-core.md#how-it-differs-from-cap-js-server)
:::

`@cap.js/server` คือไลบรารีฝั่งเซิร์ฟเวอร์ของ Cap สำหรับสร้างและตรวจสอบ challenge ติดตั้งด้วยตัวจัดการแพ็กเกจที่คุณถนัด:

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

## เริ่มต้นใช้งาน

คุณต้องมีฐานข้อมูลไว้เก็บ challenge และ token นี่คือตัวอย่างที่ใช้โมดูล SQL ของ Bun กับฐานข้อมูล Postgres:

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

จากนั้นเชื่อมสิ่งนี้เข้ากับแบ็กเอนด์ของคุณ เพื่อเปิดเส้นทางที่วิดเจ็ตต้องใช้:

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

ในตัวอย่างนี้ API ของ Cap อยู่ที่ `/cap/` ให้ตั้งค่านี้ในวิดเจ็ตของคุณเป็น `data-cap-api-endpoint` ([ดูเอกสารวิดเจ็ต](./widget.md))

เมื่อมีคนทำ CAPTCHA เสร็จและส่ง token กลับมาที่แบ็กเอนด์ของคุณ คุณก็ตรวจสอบ token แล้วทำงานตามตรรกะของคุณต่อได้

```js
const { success } = await cap.validateToken("...");

if (!success) throw new Error("invalid cap token");

// ...your logic
```

## เมธอดและอาร์กิวเมนต์

#### `new Cap({ ... })`

**อาร์กิวเมนต์**

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

  // เลิกใช้แล้ว:

  // ใช้สำหรับที่เก็บข้อมูลแบบคีย์-ค่าในรูป JSON
  // "tokens_store_path": ".data/tokensList.json",

  // ปิดการทำงานกับระบบไฟล์ทั้งหมด มักใช้ควบคู่กับการแก้ไข state
  // "noFSState": false,
}
```

คุณอ่านหรือกำหนดตัวเลือกของคลาส `Cap` ได้เสมอผ่านอ็อบเจกต์ `cap.config`

#### `await cap.createChallenge({ ... })`

**อาร์กิวเมนต์**

```json
{
  "challengeCount": 50,
  "challengeSize": 32,
  "challengeDifficulty": 4,
  "expiresMs": 600000
}
```

**ผลลัพธ์:** `{ challenge, token, expires }`

#### `cap.redeemChallenge({ ... })`

```json
{
  token,
  solutions
}
```

**ผลลัพธ์:** `{ success, token }`

#### `await cap.validateToken("...", { ... })`

**อาร์กิวเมนต์:**

```json
{
  "keepToken": false
}
```

**ผลลัพธ์:** `{ success }`

#### `await cap.cleanup()`

ล้าง challenge และ token ที่หมดอายุทั้งหมด โดยปกติระบบทำให้อัตโนมัติอยู่แล้ว
