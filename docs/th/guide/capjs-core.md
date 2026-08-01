---
outline: [2, 3, 4]
description: "capjs-core คือไลบรารีฝั่งเซิร์ฟเวอร์แบบไร้สถานะของ Cap สำหรับสร้างและตรวจสอบ challenge แบบ proof-of-work ที่ใช้ JWT โฮสต์ CAPTCHA โอเพนซอร์สนี้เองบน Workers หรือที่ edge ได้"
---

# ไลบรารีหลัก

Cap มีไลบรารีฝั่งเซิร์ฟเวอร์แบบไร้สถานะสำหรับสร้างและตรวจสอบ challenge ที่อิงกับ JWT ซึ่ง Standalone ก็ใช้ไลบรารีนี้ภายใน

สำหรับผู้ใช้ส่วนใหญ่ เราแนะนำ [Cap Standalone](./standalone/index.md) ที่รันบน Docker และมีทุกอย่างครบ เราแนะนำให้ใช้ไลบรารีหลักโดยตรงเฉพาะเมื่อคุณรัน Docker ไม่ได้ ต้องการฝังการสร้าง challenge เข้าไปในบริการที่มีอยู่ หรือต้องดีพลอยไปยังสภาพแวดล้อมที่ไม่มีที่เก็บข้อมูลถาวร (Cloudflare Workers, Lambda, edge function)

## การติดตั้ง

::: code-group

```sh [bun]
bun add capjs-core
```

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm i capjs-core
```

:::

## เริ่มต้นใช้งาน

```js
import { generateChallenge, validateChallenge } from "capjs-core";

// ยาว สุ่ม และมีเอนโทรปีสูง ต้องใช้ค่าเดียวกันทุกโพรเซส
const SECRET = process.env.CAP_SECRET;

// 1) เส้นทางฝั่งเซิร์ฟเวอร์: สร้าง challenge
const ch = await generateChallenge(SECRET, {
  scope: "signup", // ไม่บังคับ
  instrumentation: true, // ไม่บังคับ ดูด้านล่าง
});
// → { challenge: { c, s, d }, token, expires, instrumentation? }

// 2) เส้นทางฝั่งเซิร์ฟเวอร์: ตรวจสอบ challenge ที่ถูกใช้
const result = await validateChallenge(
  SECRET,
  {
    token: req.body.token,
    solutions: req.body.solutions,
    instr: req.body.instr,
  },
  {
    scope: "signup",
    consumeNonce: async (sigHex, ttlMs) => myStore.setIfNotExists(`cap:${sigHex}`, 1, ttlMs),
  },
);

if (result.success) {
  // result.token, result.tokenKey, result.expires, result.scope
}
```

วิดเจ็ตเรียก `generateChallenge` เพื่อรับ `{ challenge, token, expires, instrumentation }` แก้ proof-of-work ฝั่งไคลเอนต์ แล้ว POST `{ token, solutions, instr }` กลับมา จากนั้นคุณเรียก `validateChallenge` เพื่อตรวจสอบ

## ต่างจาก `@cap.js/server` อย่างไร {#how-it-differs-from-cap-js-server}

| ประเด็น             | `@cap.js/server`                           | `capjs-core`                                  |
| ------------------- | ------------------------------------------ | --------------------------------------------- |
| สถานะ               | เก็บ token ในหน่วยความจำและระบบไฟล์          | ไร้สถานะ challenge token เป็น JWT ที่ลงลายเซ็น |
| ตัวสร้าง            | `new Cap({ ... })`                          | ไม่มี — ส่ง `secret` ทุกครั้งที่เรียก          |
| ป้องกัน replay      | มีรายการ token ในตัวพร้อมรอบทำความสะอาด     | เลือกเปิดผ่าน callback `consumeNonce`          |
| hook ทำความสะอาด    | flush ตอน `SIGINT`/`beforeExit`             | ไม่มี — TTL ฝังอยู่ใน `exp` ของ JWT            |
| ระบบไฟล์            | จำเป็นสำหรับการเก็บถาวร                      | ไม่แตะเลย                                      |
| ใช้กับ Worker ได้   | ไม่ได้ (เพราะใช้ระบบไฟล์)                   | ได้                                            |

ต่างจากไลบรารีเดิม `capjs-core` ไม่ตรวจสอบ redeem token ให้คุณ มันคืน `tokenKey` ที่คุณต้องเก็บเอง และ `token` ที่คุณส่งให้ผู้ใช้ เวลาจะตรวจสอบภายหลัง ให้คำนวณคีย์ใหม่จาก token ที่ผู้ใช้ส่งมาแล้วค้นหา:

```js
import { createHash } from "node:crypto";

// เส้นทางสำหรับตรวจสอบ
const [id, verToken] = req.body.token.split(":");
const tokenKey = `${id}:${createHash("sha256").update(verToken).digest("hex")}`;
const expires = await myStore.get(`cap-token:${tokenKey}`);
if (!expires || Number(expires) < Date.now()) {
  return res.status(401).end();
}
```

## API

### `generateChallenge(secret, opts?)`

คืนค่า `Promise<{ challenge, token, expires, instrumentation? }>`

- `secret` — สตริงหรือ Buffer ขนาด ≥16 ไบต์ เป็นคีย์ HMAC หลัก ต้องเหมือนกันทุกโพรเซส
- `opts.challengeCount` — จำนวนปริศนา PoW ค่าเริ่มต้น `50`
- `opts.challengeSize` — ความยาว salt เป็นอักขระฐานสิบหก ค่าเริ่มต้น `32`
- `opts.challengeDifficulty` — ความยาวคำนำหน้าเป้าหมายเป็นอักขระฐานสิบหก ค่าเริ่มต้น `4`
- `opts.expiresMs` — TTL ของ challenge ค่าเริ่มต้น `600_000` (10 นาที)
- `opts.scope` — สตริงเสริมที่ผูกกับ challenge การตรวจสอบต้องส่ง `scope` เดียวกัน
- `opts.extra` — อ็อบเจกต์เสริมที่ฝังไว้ใน payload ของ JWT (ใครที่ถือ token ก็เห็นได้)
- `opts.instrumentation` — `true` เพื่อใช้ค่าเริ่มต้น หรือเป็นอ็อบเจกต์: `{ blockAutomatedBrowsers, obfuscationLevel }`
- `opts.instrumentationGenerator` — ทางออกสำหรับย้ายการสร้างสคริปต์ไปไว้ที่ worker pool

`token` คือ JWT ที่ลงลายเซ็นและบรรจุการตั้งค่าของ challenge ส่วน `expires` คือเวลาหมดอายุของ JWT เป็นมิลลิวินาที และ `instrumentation` (ถ้าร้องขอ) คือสคริปต์ฝั่งไคลเอนต์แบบ deflate+base64 ที่วิดเจ็ตจะนำไปรัน

### `validateChallenge(secret, body, opts?)`

คืนค่า `Promise<{ success: true, token, tokenKey, expires, scope, iat } | { success: false, reason, instr_error? }>`

`body`:

- `token` — challenge token จาก `generateChallenge`
- `solutions` — อาร์เรย์ของตัวเลข ความยาวต้องเท่ากับ `challenge.c`
- `instr` — ผลลัพธ์ instrumentation (ถ้าคุณเปิดใช้)
- `instr_blocked`, `instr_timeout` — แฟล็กจากวิดเจ็ตเมื่อ instrumentation ปฏิเสธหน้านั้น

`opts`:

- `scope` — ต้องตรงกับ scope ของ challenge เดิม
- `tokenTtlMs` — TTL ของ redeem token ค่าเริ่มต้น `1_200_000` (20 นาที)
- `consumeNonce(sigHex, ttlMs)` — ป้องกัน replay ผ่านที่เก็บข้อมูลของคุณ ดูด้านล่าง
- `signToken(data)` — ฟังก์ชัน async ที่คืนรูปแบบ redeem token ของคุณเอง ค่าเริ่มต้นคืน `id:secret`

#### สาเหตุที่ล้มเหลว

| `reason`            | ความหมาย                                                    |
| ------------------- | ------------------------------------------------------------ |
| `invalid_body`      | body ไม่ใช่อ็อบเจกต์                                        |
| `missing_token`     | ไม่ได้ส่ง token มา                                          |
| `missing_solutions` | ไม่มี solutions หรือไม่ใช่อาร์เรย์                          |
| `invalid_token`     | ลายเซ็น JWT ไม่ตรง / รูปแบบผิด / พารามิเตอร์เกินขอบเขต       |
| `scope_mismatch`    | scope ของ token ไม่ตรงกับ `opts.scope`                      |
| `expired`           | JWT ของ challenge หมดอายุ                                   |
| `invalid_solutions` | ความยาวไม่ตรงหรือมีค่าที่ไม่ใช่ตัวเลข                        |
| `nonce_store_error` | callback `consumeNonce` โยนข้อผิดพลาด                        |
| `already_redeemed`  | `consumeNonce` คืนค่า `false`                                |
| `invalid_solution`  | solutions ไม่ผ่านเงื่อนไข PoW                                |
| `instr_*`           | instrumentation ล้มเหลว (พร้อม `instr_error: true`)          |

## การป้องกัน replay

ไลบรารีนี้ออกแบบมาให้ไร้สถานะ เพื่อกันไม่ให้ข้อมูลที่ถูกดักจับถูกนำไปใช้ซ้ำ ให้ส่ง callback `consumeNonce` เข้าไป `capjs-core` จะเรียกมันพร้อมค่าฐานสิบหกของลายเซ็น JWT และ TTL ที่เหลือ คุณเก็บค่าฐานสิบหกนั้นไว้ใน KV ของคุณด้วยความหมายแบบ `SET NX EX` แล้วคืน `false` เมื่อเจอซ้ำ

::: code-group

```js [redis]
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

const consumeNonce = async (sigHex, ttlMs) => {
  const ttlSec = Math.ceil(ttlMs / 1000);
  const ok = await redis.set(`cap:${sigHex}`, "1", "NX", "EX", ttlSec);
  return ok === "OK";
};
```

```js [cloudflare-kv]
const consumeNonce = async (sigHex, ttlMs) => {
  const key = `cap:${sigHex}`;
  if (await env.NONCES.get(key)) return false;
  await env.NONCES.put(key, "1", {
    expirationTtl: Math.ceil(ttlMs / 1000),
  });
  return true;
};
```

```js [postgres]
const consumeNonce = async (sigHex, ttlMs) => {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  try {
    await db`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sigHex}, ${expiresAt})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false; // unique violation
    throw e;
  }
};
```

:::

การตรวจนี้ทำงาน _หลัง_ การตรวจสอบ PoW และ instrumentation ดังนั้นผู้โจมตีที่เล่นซ้ำข้อมูลที่ดักมาพร้อมคำตอบมั่ว ๆ จะเผา nonce ของผู้ใช้ตัวจริงไม่ได้

## Instrumentation

ส่ง `instrumentation: true` (หรืออ็อบเจกต์ตัวเลือก) ให้ `generateChallenge` เพื่อรับสคริปต์ฝั่งไคลเอนต์แบบ deflate+base64 วิดเจ็ตจะรันมัน ส่งลายนิ้วมือกลับมา แล้ว `validateChallenge` จะตรวจสอบ

```js
const ch = await generateChallenge(SECRET, {
  instrumentation: {
    blockAutomatedBrowsers: true, // ปฏิเสธ playwright/puppeteer/selenium
    obfuscationLevel: 3, // 1-10 ค่าเริ่มต้น 3
  },
});
```

เมื่อเปิด `blockAutomatedBrowsers` สคริปต์จะรันการตรวจแบบ realm-escape และการตรวจเชิงพฤติกรรม ซึ่งตรวจจับ Chromium แบบ headless, ร่องรอยของเฟรมเวิร์กอัตโนมัติ และการปลอมตัวเป็น JS sandbox ดูรายละเอียดที่ [Instrumentation](./instrumentation.md)

ระดับการทำให้อ่านยากที่สูงขึ้นจะสร้างช้าลง ระดับ 4–7 เพิ่มการอ้อมผ่านตารางสตริงแบบกำหนดเอง พร้อมการย่อโค้ดด้วย esbuild ส่วนระดับ 8–10 เพิ่ม `javascript-obfuscator` เข้าไปอีกชั้น (string-array, control-flow flattening, การแทรกโค้ดตาย) ซึ่งจะบล็อก event loop หลายสิบมิลลิวินาทีต่อ challenge จึงควรใช้เฉพาะกับเส้นทางที่มีปริมาณน้อย หรือใส่ `instrumentationGenerator` ของคุณเองที่รันอยู่ใน worker pool

## รูปแบบการดีพลอยแบบไร้สถานะ

**คำเตือน:** สคริปต์เหล่านี้ไม่มีการป้องกัน replay ในตัว อย่าลืมเพิ่มเอง

### Cloudflare Workers

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = (env) => env.CAP_SECRET;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/challenge" && req.method === "POST") {
      const ch = await generateChallenge(SECRET(env), { instrumentation: true });
      return Response.json(ch);
    }

    if (url.pathname === "/redeem" && req.method === "POST") {
      const body = await req.json();
      const result = await validateChallenge(SECRET(env), body, {
        consumeNonce: async (sigHex, ttlMs) => {
          if (await env.NONCES.get(`cap:${sigHex}`)) return false;
          await env.NONCES.put(`cap:${sigHex}`, "1", {
            expirationTtl: Math.ceil(ttlMs / 1000),
          });
          return true;
        },
      });
      return Response.json(result);
    }

    return new Response("not found", { status: 404 });
  },
};
```

### Bun

```js
import { generateChallenge, validateChallenge } from "capjs-core";
const SECRET = process.env.CAP_SECRET;

Bun.serve({
  port: 3000,
  routes: {
    "/challenge": {
      POST: () => Response.json(generateChallenge(SECRET, { instrumentation: true })),
    },
    "/redeem": {
      POST: async (req) => {
        const body = await req.json();
        return Response.json(await validateChallenge(SECRET, body));
      },
    },
  },
});
```

## challenge แบบ RSW

ตั้งแต่ v0.1.1 และวิดเจ็ต v0.1.51 ทั้งสองฝั่งเข้าใจรูปแบบข้อมูลที่ยืดหยุ่นขึ้น ซึ่งรองรับโปรโตคอล challenge หลายแบบในคำตอบเดียว ได้แก่ PoW แบบ SHA-256 (ค่าเริ่มต้น), [ปริศนา time-lock แบบ RSW](./rsw.md) ตัวใหม่ และ instrumentation

### การเปิดใช้ขั้นต่ำ {#format-2-rsw-opt-in}

```js
import { generateChallenge, generateRswKeypair, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const KEYPAIR = generateRswKeypair(2048); // ทำครั้งเดียวตอนบูต และต้องเก็บไว้!

app.post("/api/challenge", async () => {
  return await generateChallenge(SECRET, {
    format: 2,
    protocols: ["rsw", "instrumentation"],
    keypair: KEYPAIR,
    t: 75_000, // ไม่บังคับ เราแนะนำให้คงไว้ที่ 75_000
  });
});

app.post("/api/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```
