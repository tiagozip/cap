---
outline: [2, 3]
description: "ติดตั้ง Cap ซึ่งเป็น CAPTCHA โอเพนซอร์สที่โฮสต์เองได้ ภายในราวห้านาที รันเซิร์ฟเวอร์ด้วย Docker หรือรันในแบ็กเอนด์ของคุณเอง เพิ่มวิดเจ็ต แล้วตรวจสอบ token ไม่มี Google ไม่มีเทเลเมทรี ไม่มีปริศนาภาพ"
---

# เริ่มต้นใช้งาน

Cap มีสองส่วน คือวิดเจ็ตซึ่งรันและแก้ challenge ในเบราว์เซอร์ของผู้เข้าชมแล้วส่ง token ให้คุณ กับเซิร์ฟเวอร์ (capd) ซึ่งออก challenge และตรวจสอบ token เหล่านั้น

## 1. ตั้งค่า capd {#_1-set-up-capd}

ขั้นแรก คุณต้องตั้งค่า capd ซึ่งรันเป็นเซิร์ฟเวอร์ที่โฮสต์เอง มาพร้อมแดชบอร์ด สถิติการใช้งาน กฎ และ API โดยเก็บคีย์และการตั้งค่าไว้ใน Valkey ก่อนเริ่ม คุณต้องตัดสินใจสองเรื่อง:

**1. จะรัน capd ที่ไหน:** คุณรันบนเซิร์ฟเวอร์ของคุณเองด้วย Docker ใช้ [Railway](https://railway.com/deploy/cap-1?referralCode=93HYBZ&utm_medium=integration&utm_source=template&utm_campaign=generic) หรือใช้แพลตฟอร์ม serverless อย่าง [Workers](./capd/workers.md) ก็ได้ คู่มือนี้จะพาคุณใช้ Docker

**2. จะเก็บสถิติไว้ที่ไหน:** คุณใช้ DuckDB ซึ่งเบาและเหมาะกับเว็บไซต์ขนาดเล็ก หรือ ClickHouse ซึ่งขยายระบบได้ดีกว่าก็ได้ ทั้งสองตัวมีมาให้ในตัวและตั้งค่าได้ง่าย

::: code-group

```bash [DuckDB]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.duckdb.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

```bash [ClickHouse]
curl -fsSLo docker-compose.yml https://raw.githubusercontent.com/tiagozip/cap/main/capd/docker-compose.yml
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .env
docker compose up -d
```

:::

เปิด `http://localhost:3000` แล้วเข้าสู่ระบบด้วย `ADMIN_KEY` จาก `.env` ซึ่งก็คือรหัสผ่านแดชบอร์ด สร้าง site key แล้วคัดลอกทั้ง site key และ secret ของมันเก็บไว้

วิดเจ็ตจะติดต่อกับเซิร์ฟเวอร์นี้จากเบราว์เซอร์ของผู้เข้าชม ดังนั้นในระบบจริงเซิร์ฟเวอร์ต้องมี URL สาธารณะ เราแนะนำให้ใช้บริการอย่าง [Tunnels](https://developers.cloudflare.com/tunnel/) แต่[เอกสารของ capd](./capd/index.md) ก็อธิบายกรณีอื่น ๆ ไว้เกือบทั้งหมด รวมถึง reverse proxy ด้วย

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

endpoint คือ `https://<your-instance>/<site-key>/`

เมื่อผู้เข้าชมแก้ challenge เสร็จ วิดเจ็ตจะเพิ่มฟิลด์ซ่อน `cap-token` ลงในฟอร์ม ถ้าไม่ได้อยู่ในฟอร์ม ให้ดักฟังเหตุการณ์ `solve` แทน:

```js
document.querySelector("cap-widget").addEventListener("solve", (e) => {
  const token = e.detail.token;
});
```

[หน้าวิดเจ็ต](./widget.md)มีตัวอย่างโค้ดสำหรับ React, Vue, Svelte และเฟรมเวิร์กอื่น ๆ

## 3. ตรวจสอบ token {#_3-verify-the-token}

ก่อนจะเชื่อข้อมูลที่ส่งเข้ามา ให้ส่ง token ของมันจากเซิร์ฟเวอร์ของคุณไปที่ `/siteverify`:

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

ถ้าคุณย้ายมาจาก reCAPTCHA `/siteverify` รองรับรูปแบบคำขอเดียวกัน โค้ดตรวจสอบของคุณจึงแค่เปลี่ยนไปใช้ hostname ของเซิร์ฟเวอร์คุณเท่านั้น

token ที่ถูกต้องจะได้ผลลัพธ์เป็น `{ "success": true }` token แต่ละอันใช้ได้ครั้งเดียว การตรวจสอบ token เดิมเป็นครั้งที่สองจึงล้มเหลว การส่งซ้ำสองครั้งจึงเป็นวิธีง่าย ๆ ในการเช็กว่าการตั้งค่าทำงานครบทุกขั้นตอน

## ใช้ core library แทน {#using-the-core-library-instead}

ถ้าคุณอยากออกและตรวจสอบ challenge ภายในแบ็กเอนด์ของคุณเอง [core library](./capjs-core.md) คือแพ็กเกจ npm ขนาดเล็กที่ทำแค่งานนั้น คุณเก็บ token ไว้ในฐานข้อมูลของคุณเอง และจะไม่มีแดชบอร์ด สถิติการใช้งาน หรือการจำกัดอัตราคำขอ

## ขั้นตอนถัดไป {#next-steps}

- [ปรับแต่งวิดเจ็ต](./widget.md#attributes) ทั้งข้อความ ภาษา และสไตล์
- [ตั้งค่า capd](./capd/options.md) ทั้งพร็อกซี ไฟล์วิดเจ็ต และ API
- อ่าน[เอกสารอ้างอิงของ core library](./capjs-core.md)
- อ่าน[วิธีการทำงานของ Cap](./workings.md)
