---
description: "Cap Standalone คือวิธีที่ง่ายที่สุดในการโฮสต์แบ็กเอนด์ของ CAPTCHA โอเพนซอร์สตัวนี้เอง: ใช้ Docker มี instrumentation, API ที่เข้ากันได้กับ reCAPTCHA และแดชบอร์ดบนเว็บ"
---

# Cap Standalone

Cap Standalone คือวิธีที่เราแนะนำสำหรับการโฮสต์แบ็กเอนด์ของ Cap เอง มันรันบน Bun และใช้หน่วยความจำขณะว่างราว 50 MB มาพร้อมการรองรับ challenge แบบ instrumentation ในตัว ซึ่งยกระดับความยากสำหรับบอทอย่างมาก มี siteverify API ที่เข้ากันได้กับ reCAPTCHA และมีแดชบอร์ดบนเว็บสำหรับจัดการ site key หลายชุด

เราแนะนำให้ใช้ [Docker](https://docs.docker.com/get-docker/) ในการรัน Cap Standalone

## การติดตั้ง

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

::: tip เคล็ดลับ

- `ADMIN_KEY` คือรหัสเข้าสู่ระบบแดชบอร์ดของคุณ เราแนะนำให้ยาวอย่างน้อย 32 ตัวอักษร
- เปลี่ยน `3000:3000` ถ้าพอร์ตนั้นถูกใช้อยู่แล้วบนเครื่องโฮสต์ของคุณ
- ถ้าเข้าแดชบอร์ดไม่ได้ ลองเพิ่ม `network_mode: "host"` ใต้เซอร์วิส `cap`
  :::

เริ่มคอนเทนเนอร์:

```bash
docker compose up -d
```

เปิด `http://localhost:3000` (หรือ IP/โดเมนของเซิร์ฟเวอร์คุณที่พอร์ต 3000) เพื่อเข้าแดชบอร์ด เข้าสู่ระบบด้วย admin key ของคุณ สร้าง site key แล้วจดทั้ง **site key** และ **secret key** ของมันไว้ เพราะต้องใช้ทั้งคู่

challenge แบบ instrumentation จะเปิดใช้งานโดยค่าเริ่มต้นเมื่อสร้าง site key ใหม่ เราแนะนำให้เปิดไว้ เพราะมันยกระดับความยากสำหรับบอทอย่างมาก คุณยังเปิดการตรวจจับเบราว์เซอร์แบบ headless เพื่อเพิ่มการป้องกันได้ด้วย

อินสแตนซ์ Cap Standalone ของคุณต้องเข้าถึงได้จากอินเทอร์เน็ตแบบสาธารณะ เพื่อให้วิดเจ็ตสื่อสารกับมันได้ ถ้าคุณใช้ reverse proxy ให้ดู[คู่มือตัวเลือกการตั้งค่า](/th/guide/standalone/options.md) เพื่อกำหนดการจำกัดอัตราคำขอให้ถูกต้อง

## วิธีใช้งาน

### ฝั่งไคลเอนต์

ชี้วิดเจ็ตมาที่อินสแตนซ์ของคุณด้วยการตั้งแอตทริบิวต์ `data-cap-api-endpoint`:

```
https://<instance_url>/<site_key>/
```

- `<instance_url>` — URL สาธารณะของอินสแตนซ์ Cap Standalone ของคุณ
- `<site_key>` — site key จากแดชบอร์ดของคุณ

ตัวอย่าง:

```html
<cap-widget data-cap-api-endpoint="https://cap.example.com/d9256640cb53/"></cap-widget>
```

เราแนะนำให้อ่าน[เอกสารวิดเจ็ต](../widget.md) เพื่อดูรายละเอียดเพิ่มเติมและตัวอย่างโค้ดสำหรับหลายเฟรมเวิร์ก

### ฝั่งเซิร์ฟเวอร์

เมื่อผู้ใช้ทำ CAPTCHA เสร็จ แบ็กเอนด์ของคุณต้องตรวจสอบ token ก่อนจะเชื่อถือมัน ส่งคำขอ `POST` ไปยัง endpoint `/siteverify` ของอินสแตนซ์คุณ พร้อม JSON body ดังนี้:

```bash
curl "https://<instance_url>/<site_key>/siteverify" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "secret": "<key_secret>", "response": "<captcha_token>" }'
```

โดย `<key_secret>` คือ secret key จากแดชบอร์ดของคุณ (**ไม่ใช่** admin key ของแดชบอร์ด) และ `<captcha_token>` คือ challenge token ที่วิดเจ็ตสร้างขึ้น

เมื่อตรวจสอบผ่าน จะได้ผลลัพธ์:

```json
{ "success": true }
```
