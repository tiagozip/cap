---
outline: deep
description: "ติดตั้ง Cap ซึ่งเป็น CAPTCHA โอเพนซอร์สที่โฮสต์เองได้ ภายในราวห้านาที รันเซิร์ฟเวอร์ด้วย Docker วางวิดเจ็ต แล้วตรวจสอบ token ไม่มี Google ไม่มีเทเลเมทรี ไม่มีปริศนาภาพ"
---

# เริ่มต้นใช้งาน

Cap คือ CAPTCHA ที่โฮสต์เองได้ ซึ่งแทนที่ปริศนารูปภาพด้วย proof-of-work แบบล่องหน ผู้ใช้ของคุณคลิกช่องติ๊กเพียงช่องเดียว งานคำนวณทำงานเงียบ ๆ ในเบราว์เซอร์ของเขา และไม่มีข้อมูลใดของเขาออกจากเซิร์ฟเวอร์ของคุณ ไม่มี Google ไม่มีเทเลเมทรี ไม่มีค่าธรรมเนียมต่อคำขอ

Cap มีสองส่วน: **วิดเจ็ต** ที่รัน challenge และแสดงช่องติ๊ก กับ **เซิร์ฟเวอร์** ที่ออก challenge และตรวจสอบคำตอบ คุณจะได้ทั้งสองส่วนทำงานภายในราวห้านาที

**นี่คือวิดเจ็ตตัวจริง:**

<Demo />

::: tip ใช้ reCAPTCHA อยู่แล้วใช่ไหม?
`/siteverify` ของ Cap เข้ากันได้กับ API ของ reCAPTCHA คุณชี้โค้ดตรวจสอบเดิมมาที่ Cap ได้ด้วยการเปลี่ยน URL เพียงจุดเดียว รันคู่ขนานกันไปก่อน แล้วค่อยสลับมาใช้เต็มตัวเมื่อพร้อม ไม่ต้องเขียนใหม่และไม่ต้องเสี่ยงเปลี่ยนทีเดียวทั้งระบบ ดู[การเปรียบเทียบฟีเจอร์](./alternatives.md)
:::

## สิ่งที่ต้องมี

- [Docker](https://docs.docker.com/get-docker/) (วิธีที่เร็วที่สุดในการรันเซิร์ฟเวอร์)
- ที่สำหรับโฮสต์ซึ่งเบราว์เซอร์ของผู้ใช้เข้าถึงได้
- เวลาสักไม่กี่นาที

## 1. รันเซิร์ฟเวอร์

เราแนะนำ [Cap Standalone](./standalone/index.md) ซึ่งเป็นคอนเทนเนอร์เดียวที่เปิด REST API เล็ก ๆ พร้อมแดชบอร์ดสำหรับจัดการคีย์ รองรับ site key หลายชุด และเข้ากันได้กับ siteverify API ของ reCAPTCHA

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic)

สร้างไฟล์ `docker-compose.yml`:

```yaml
services:
  cap:
    image: tiago2/cap:latest
    container_name: cap
    ports:
      - "3000:3000"
    environment:
      ADMIN_KEY: your_secret_password
      REDIS_URL: redis://valkey:6379
    depends_on:
      valkey:
        condition: service_healthy
    restart: unless-stopped

  valkey:
    image: valkey/valkey:9-alpine
    container_name: cap-valkey
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

เริ่มการทำงาน:

```bash
docker compose up -d
```

เปิด `http://localhost:3000` (หรือ IP หรือโดเมนของเซิร์ฟเวอร์คุณที่พอร์ต 3000) เข้าสู่ระบบด้วย `ADMIN_KEY` ของคุณ แล้วสร้าง site key คุณจะได้ **site key** และ **secret key** เก็บไว้ทั้งคู่ เพราะต้องใช้ในขั้นตอนถัดไป

::: tip เคล็ดลับ

- `ADMIN_KEY` คือรหัสผ่านแดชบอร์ดของคุณ ควรตั้งให้ยาวอย่างน้อย 32 ตัวอักษร
- เปลี่ยน `3000:3000` ถ้าพอร์ตนั้นถูกใช้อยู่แล้ว
- ถ้าเข้าแดชบอร์ดไม่ได้ ให้เพิ่ม `network_mode: "host"` ใต้เซอร์วิส `cap`
  :::

## 2. เพิ่มวิดเจ็ต

วิดเจ็ตเป็น web component ตัวเดียวจบ ถ้าไม่อยากตรึงเวอร์ชัน ให้แทน `<version>` ด้วย `latest`

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

::: tip
ดู[รีลีสล่าสุด](https://github.com/tiagozip/cap/releases) เพื่อเลือกเวอร์ชันที่จะตรึงไว้ ในระบบที่ต้องการความปลอดภัยสูง คุณโฮสต์ไฟล์นี้เองแทนการโหลดจาก CDN ได้
:::

### วิธีง่ายที่สุด: วางไว้ในฟอร์ม

ถ้าวิดเจ็ตของคุณอยู่ใน `<form>` Cap จะแทรกฟิลด์ซ่อน `cap-token` ให้อัตโนมัติและส่งไปพร้อมข้อมูลฟอร์มส่วนที่เหลือ ไม่ต้องเขียน JavaScript เลย

```html
<form action="/submit" method="POST">
  <!-- ฟิลด์ของคุณ -->
  <cap-widget data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">ส่ง</button>
</form>
```

- `<your-instance>` คือ URL สาธารณะของเซิร์ฟเวอร์ Cap ของคุณ เช่น `cap.example.com` ซึ่งผู้เข้าชมต้องเข้าถึงได้ จึงใช้ `localhost` ไม่ได้
- `<site-key>` คือ site key จากแดชบอร์ดของคุณ

เมื่อส่งฟอร์ม เซิร์ฟเวอร์ของคุณจะได้รับ `cap-token` มาพร้อมฟิลด์อื่น ๆ ข้ามไปที่[ขั้นตอนที่ 3](#_3-verify-the-token) เพื่อตรวจสอบมัน

### ด้วย JavaScript: เมื่อคุณต้องการควบคุมเอง

สำหรับ SPA ขั้นตอนที่ปรับแต่งเอง หรืออะไรก็ตามที่ไม่ใช่ฟอร์มธรรมดา ให้ดักฟังเหตุการณ์ `solve`:

```js
const widget = document.querySelector("cap-widget");
widget.addEventListener("solve", (e) => {
  const token = e.detail.token;
  // ส่ง token ไปยังเซิร์ฟเวอร์ของคุณ เปิดใช้งานปุ่มส่ง ฯลฯ
});
```

คุณยังเรนเดอร์วิดเจ็ตแบบล่องหนแล้วแก้ challenge [ด้วยโค้ด](./programmatic.md) หรือใช้[โหมดลอย](./floating.md) ก็ได้ ตัวอย่างโค้ดสำหรับเฟรมเวิร์กต่าง ๆ (React, Vue, Svelte และอื่น ๆ) อยู่ใน[หน้าวิดเจ็ต](./widget.md#usage)

## 3. ตรวจสอบ token {#_3-verify-the-token}

ก่อนจะเชื่อข้อมูลที่ส่งเข้ามา เซิร์ฟเวอร์ของคุณต้องตรวจสอบ token เสียก่อน ส่ง `POST` ไปยัง endpoint `/siteverify` ของอินสแตนซ์คุณ:

::: code-group

```sh [curl]
curl "https://<your-instance>/<site-key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

```js [fetch]
const { success } = await (
  await fetch("https://<your-instance>/<site-key>/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: "<key_secret>", response: "<captcha_token>" }),
  })
).json();

if (!success) throw new Error("invalid cap token");
```

```py [python]
import requests

success = requests.post(
    "https://<your-instance>/<site-key>/siteverify",
    json={"secret": "<key_secret>", "response": "<captcha_token>"},
).json().get("success")
```

```php [php]
<?php
$data = json_decode(file_get_contents("https://<your-instance>/<site-key>/siteverify",
  false, stream_context_create([
    "http" => [
      "method" => "POST",
      "header" => "Content-Type: application/json",
      "content" => json_encode(["secret"=>"<key_secret>","response"=>"<captcha_token>"])
    ]
  ])
), true);
var_dump($data['success'] ?? false);
```

:::

- `<key_secret>` คือ **secret key** จากแดชบอร์ดของคุณ ไม่ใช่ `ADMIN_KEY` ของแดชบอร์ด การสับสนสองอย่างนี้คือความผิดพลาดตอนตั้งค่าที่พบบ่อยที่สุด
- `<captcha_token>` คือ token จากวิดเจ็ต (ฟิลด์ฟอร์ม `cap-token` หรือ `e.detail.token`)

token ที่ถูกต้องจะได้ผลลัพธ์:

```json
{ "success": true }
```

token ใช้ได้ครั้งเดียว ให้ตรวจสอบแต่ละอันเพียงครั้งเดียว แล้วจึงรันตรรกะของคุณต่อ (สร้างบัญชี ส่งข้อความ ฯลฯ)

## 4. ยืนยันว่าใช้งานได้จริง

ตรวจแบบครบวงจรอย่างรวดเร็ว:

1. โหลดหน้าเว็บของคุณ ช่องติ๊กควรถูกติ๊ก และ handler `solve` (หรือฟิลด์ฟอร์ม) ควรให้ token ออกมา
2. ส่ง token นั้นไปยัง `/siteverify` คุณควรได้ `{ "success": true }`
3. ส่ง token เดิมซ้ำอีกครั้ง คราวนี้ควรล้มเหลว ซึ่งยืนยันว่าการใช้ได้ครั้งเดียวทำงานถูกต้อง

ถ้าการตรวจสอบล้มเหลวตลอด ให้เช็กว่าคุณใช้ secret key (ไม่ใช่ admin key) และ `<your-instance>` เป็น URL สาธารณะเดียวกับที่วิดเจ็ตชี้ไป

เท่านี้ก็ครบทั้งการผนวกระบบ ผู้ใช้แก้ challenge ในเบราว์เซอร์ เซิร์ฟเวอร์ของคุณตรวจสอบ token และข้อมูลทุกไบต์ยังอยู่กับคุณ

## สร้างมาเพื่อการปฏิบัติตามข้อกำหนด

เพราะ Cap โฮสต์เอง ไม่มีคุกกี้ ไม่มีการติดตาม และไม่เรียกบริการภายนอก ข้อมูลผู้ใช้ของคุณจึงไม่เคยออกจากโครงสร้างพื้นฐานของคุณ Cap ออกแบบมาให้ตอบโจทย์ GDPR, CCPA, HIPAA, LGPD และกฎหมายความเป็นส่วนตัวอื่น ๆ อีกทั้งช่องติ๊กแบบ proof-of-work ยังเลี่ยงอุปสรรคตาม WCAG 2.2 ที่ปริศนาภาพและเสียงมักติดขัด ดูรายละเอียดทั้งหมดและกฎระเบียบที่ Cap ยึดเป็นกรอบได้ที่หน้า[การปฏิบัติตามข้อกำหนด](./compliance.md)

## ขั้นตอนถัดไป

ตอนนี้ฟอร์มของคุณได้รับการป้องกันแล้ว จากจุดนี้คุณสามารถ:

- ผนวก Cap เข้ากับสแตกของคุณด้วย[ตัวอย่างโค้ดตามเฟรมเวิร์ก](./widget.md#usage)
- [ปรับแต่งวิดเจ็ต](./widget.md#options)ทั้งหน้าตาและพฤติกรรม
- ปรับจูน [instrumentation](./instrumentation.md) และ[ตั้งค่า](./standalone/options.md) CORS กับการจำกัดอัตราคำขอ
- ดูว่า Cap เทียบกับ [reCAPTCHA, Turnstile, hCaptcha และตัวอื่น ๆ](./alternatives.md) แล้วเป็นอย่างไร
- อ่านคู่มือ[ทางเลือกแทน CAPTCHA ที่ดีที่สุดในปี 2026](./best-captcha-alternatives.md) ถ้าคุณยังอยู่ระหว่างพิจารณา
