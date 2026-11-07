---
outline: [2, 3]
description: "ติดตั้ง Cap ซึ่งเป็น CAPTCHA โอเพนซอร์สที่โฮสต์เองได้ ภายในราวห้านาที รันเซิร์ฟเวอร์ด้วย Docker หรือรันในแบ็กเอนด์ของคุณเอง เพิ่มวิดเจ็ต แล้วตรวจสอบ token ไม่มี Google ไม่มีเทเลเมทรี ไม่มีปริศนาภาพ"
---

# เริ่มต้นใช้งาน

Cap มีสองส่วน คือวิดเจ็ตซึ่งรันและแก้ challenge ในเบราว์เซอร์ของผู้เข้าชมแล้วส่ง token ให้คุณ กับเซิร์ฟเวอร์ซึ่งออก challenge และตรวจสอบ token เหล่านั้น

## เลือกเซิร์ฟเวอร์ {#pick-a-server}

- **[Standalone](./standalone/index.md)** คือคอนเทนเนอร์ Docker ที่มาพร้อมแดชบอร์ด สถิติการใช้งาน และการจำกัดอัตราคำขอ เลือกตัวนี้ถ้าคุณรันคอนเทนเนอร์ได้ ถ้าคุณย้ายมาจาก reCAPTCHA `/siteverify` ของ Standalone รองรับรูปแบบคำขอเดียวกัน โค้ดตรวจสอบของคุณจึงแค่เปลี่ยนไปใช้ hostname ของเซิร์ฟเวอร์คุณเท่านั้น

- **[core library](./capjs-core.md)** คือแพ็กเกจ npm ขนาดเล็กที่จัดการงานพื้นฐานของ Cap รันได้ทุกที่ที่โค้ดของคุณรัน รวมถึงแพลตฟอร์ม serverless อย่าง Workers และคุณเก็บ token ไว้ในฐานข้อมูลของคุณเอง แต่ไม่มีระบบสถิติในตัว

## 1. รันเซิร์ฟเวอร์ {#_1-run-the-server}

### Standalone {#standalone}

บันทึกไฟล์นี้เป็น `docker-compose.yml` หรือ[ดีพลอยด้วย Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic):

```yaml
services:
  cap:
    image: tiago2/cap:latest
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: change_me_to_something_long
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    volumes:
      - valkey-data:/data
    command: valkey-server --save 60 1 --loglevel warning --maxmemory-policy noeviction
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

volumes:
  valkey-data:
```

อย่าลืมเปลี่ยน admin key ของคุณ จากนั้นเริ่มการทำงาน:

```bash
docker compose up -d
```

เปิด `http://localhost:3000` แล้วเข้าสู่ระบบด้วย `ADMIN_KEY` ของคุณ ซึ่งก็คือรหัสผ่านแดชบอร์ด สร้าง site key แล้วคัดลอกทั้ง site key และ secret ของมันเก็บไว้

วิดเจ็ตจะติดต่อกับเซิร์ฟเวอร์นี้จากเบราว์เซอร์ของผู้เข้าชม ดังนั้นในระบบจริงเซิร์ฟเวอร์ต้องมี URL สาธารณะ เราแนะนำให้ใช้บริการอย่าง [Cloudflare Tunnels](https://developers.cloudflare.com/tunnel/) แต่[เอกสารของ Standalone](./standalone/index.md) ก็อธิบายกรณีอื่น ๆ ไว้เกือบทั้งหมด รวมถึง reverse proxy ด้วย

### core library {#core-library}

ติดตั้ง:

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

เพิ่ม route สองตัวภายใต้ prefix เดียวกัน ตัวอย่างนี้ใช้ Hono กับ Redis แต่ใช้เฟรมเวิร์กไหนก็ได้ และใช้ที่เก็บข้อมูลไหนก็ได้ที่มีคำสั่ง "set if missing" แบบ atomic:

```js
import { Hono } from "hono";
import { Redis } from "ioredis";
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;
const redis = new Redis(process.env.REDIS_URL);
const app = new Hono();

app.post("/cap/challenge", async (c) =>
  c.json(await generateChallenge(SECRET, { format: 2, protocols: ["hashwx", "instrumentation"] })),
);

app.post("/cap/redeem", async (c) => {
  const result = await validateChallenge(SECRET, await c.req.json(), {
    consumeNonce: async (sig, ttlMs) =>
      (await redis.set(`cap:nonce:${sig}`, "1", "NX", "PX", ttlMs)) === "OK",
  });
  if (result.success) {
    await redis.set(`cap:token:${result.tokenKey}`, "1", "PX", result.expires - Date.now());
  }
  return c.json(result);
});
```

`CAP_SECRET` ใช้ลงนามทุก challenge ตั้งให้ยาวและสุ่ม และใช้ค่าเดียวกันในทุกโปรเซส

## 2. เพิ่มวิดเจ็ต {#_2-add-the-widget}

โหลดสคริปต์ โดยตรึงเวอร์ชันจาก[หน้ารีลีส](https://github.com/tiagozip/cap/releases):

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

วางวิดเจ็ตไว้ในฟอร์มของคุณ:

```html
<form action="/submit" method="POST">
  <cap-widget data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

ถ้าใช้ Standalone endpoint คือ `https://<your-instance>/<site-key>/` ถ้าใช้ core library endpoint คือ prefix ของ route คุณ เช่น `/cap/`

เมื่อผู้เข้าชมแก้ challenge เสร็จ วิดเจ็ตจะเพิ่มฟิลด์ซ่อน `cap-token` ลงในฟอร์ม ถ้าไม่ได้อยู่ในฟอร์ม ให้ดักฟังเหตุการณ์ `solve` แทน:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

[หน้าวิดเจ็ต](./widget.md)มีตัวอย่างโค้ดสำหรับ React, Vue, Svelte และเฟรมเวิร์กอื่น ๆ

## 3. ตรวจสอบ token {#_3-verify-the-token}

ก่อนจะเชื่อข้อมูลที่ส่งเข้ามา ให้ตรวจสอบ token ของมันบนเซิร์ฟเวอร์ของคุณ

### Standalone {#standalone-1}

ส่ง token ไปที่ `/siteverify`:

::: code-group

```js [fetch]
const res = await fetch("https://cap.example.com/<site-key>/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: "<secret>", response: token }),
});
const { success } = await res.json();
```

```py [python]
import requests

success = requests.post(
    "https://cap.example.com/<site-key>/siteverify",
    json={"secret": "<secret>", "response": token},
).json()["success"]
```

```php [php]
$res = file_get_contents("https://cap.example.com/<site-key>/siteverify", false, stream_context_create([
  "http" => [
    "method" => "POST",
    "header" => "Content-Type: application/json",
    "content" => json_encode(["secret" => "<secret>", "response" => $token]),
  ],
]));
$success = json_decode($res, true)["success"] ?? false;
```

```sh [curl]
curl -X POST "https://cap.example.com/<site-key>/siteverify" \
  -H "Content-Type: application/json" \
  -d '{"secret": "<secret>", "response": "<token>"}'
```

:::

`<secret>` คือ secret ของ site key ไม่ใช่ `ADMIN_KEY` ของคุณ การสับสนสองอย่างนี้คือความผิดพลาดตอนตั้งค่าที่พบบ่อยที่สุด

token ที่ถูกต้องจะได้ผลลัพธ์เป็น `{ "success": true }` token แต่ละอันใช้ได้ครั้งเดียว การตรวจสอบ token เดิมเป็นครั้งที่สองจึงล้มเหลว การส่งซ้ำสองครั้งจึงเป็นวิธีง่าย ๆ ในการเช็กว่าการตั้งค่าทำงานครบทุกขั้นตอน

### core library {#core-library-1}

ค้นหา token ในที่เก็บข้อมูลที่ route redeem ของคุณเขียนไว้ แล้วลบทิ้งเพื่อไม่ให้ใช้ซ้ำได้:

```js
import { createHash } from "node:crypto";

app.post("/submit", async (c) => {
  const [id, secret] = String((await c.req.parseBody())["cap-token"] ?? "").split(":");
  const key = `cap:token:${id}:${createHash("sha256")
    .update(secret ?? "")
    .digest("hex")}`;

  if ((await redis.del(key)) !== 1) {
    return c.text("invalid captcha", 403);
  }
});
```

## ขั้นตอนถัดไป {#next-steps}

- [ปรับแต่งวิดเจ็ต](./widget.md#attributes) ทั้งข้อความ ภาษา และสไตล์
- [ตั้งค่า Standalone](./standalone/options.md) ทั้ง CORS การจำกัดอัตราคำขอ และ asset server
- อ่าน[เอกสารอ้างอิงของ core library](./capjs-core.md)
- อ่าน[วิธีการทำงานของ Cap](./workings.md)
