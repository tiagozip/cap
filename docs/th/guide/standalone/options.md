---
description: "ตัวเลือกการตั้งค่าและตัวแปรสภาพแวดล้อมของ Cap Standalone ซึ่งเป็น CAPTCHA โอเพนซอร์สที่โฮสต์เองได้: CORS, asset server, เวอร์ชันวิดเจ็ตและ WASM และอื่น ๆ"
---

# ตัวเลือกการตั้งค่า

## CORS

คุณเปลี่ยนค่า CORS เริ่มต้นสำหรับการขอและแลก challenge ได้ด้วยการตั้งตัวแปรสภาพแวดล้อม `CORS_ORIGIN` ตอนรันเซิร์ฟเวอร์ ค่าเริ่มต้นคือ `*` ซึ่งอนุญาตทุก origin ถ้าต้องการหลาย origin ให้คั่นด้วยจุลภาค เช่น `domain1.tld,domain2.tld,...`

## Asset server

Asset server ถูกปิดไว้โดยค่าเริ่มต้น เปิดใช้ได้โดยตั้งตัวแปรสภาพแวดล้อม `ENABLE_ASSETS_SERVER` เป็น `true` แล้วไฟล์จะถูกเสิร์ฟจาก endpoint `/assets`

จากนั้นอย่าลืมตั้ง `WIDGET_VERSION` และ `WASM_VERSION` ให้ตรงกับเวอร์ชันของไฟล์วิดเจ็ตและ WASM ที่คุณต้องการเสิร์ฟ ค่าเริ่มต้นคือ `latest` ซึ่งจะเสิร์ฟเวอร์ชันล่าสุด แต่ไม่แนะนำบนโปรดักชัน เพราะอาจได้การเปลี่ยนแปลงที่ทำให้ระบบพัง

เวอร์ชันที่ใช้ได้คือรีลีสบน npm ของ [`@cap.js/widget`](https://www.npmjs.com/package/@cap.js/widget?activeTab=versions) และ [`@cap.js/wasm`](https://www.npmjs.com/package/@cap.js/wasm?activeTab=versions) ตัวอย่างเช่น:

```env
ENABLE_ASSETS_SERVER=true
WIDGET_VERSION=0.1.58
WASM_VERSION=0.0.8
```

ไฟล์ของคุณจะถูกเสิร์ฟจากเส้นทางต่อไปนี้:

- `/assets/widget.js`
- `/assets/floating.js`
- `/assets/cap_wasm_bg.wasm`
- `/assets/hashwx.wasm`
- `/assets/cap_wasm.js`

นำไปใช้ในแอปของคุณได้โดยตั้ง src ของสคริปต์วิดเจ็ตให้ชี้ไปยังเส้นทางที่เหมาะสม เช่น:

```html
<script src="https://<server url>/assets/widget.js"></script>
```

สำหรับโหมดลอย ให้ใช้:

```html
<script src="https://<server url>/assets/floating.js"></script>
```

และตั้ง `window.CAP_CUSTOM_WASM_URL` กับ `window.CAP_CUSTOM_HASHWX_URL` ให้ชี้ไปยังไฟล์ `cap_wasm_bg.wasm` และ `hashwx.wasm` แบบนี้:

```js
window.CAP_CUSTOM_WASM_URL = "https://<server url>/assets/cap_wasm_bg.wasm";
window.CAP_CUSTOM_HASHWX_URL = "https://<server url>/assets/hashwx.wasm";
```

`hashwx.wasm` มีอยู่ใน `@cap.js/wasm` ตั้งแต่ 0.0.8 ขึ้นไป ถ้า `WASM_VERSION` เก่ากว่านั้น `/assets/hashwx.wasm` จะตอบกลับเป็น 503 ในกรณีนี้อย่าตั้ง `CAP_CUSTOM_HASHWX_URL` แล้ววิดเจ็ตจะโหลดไฟล์นี้จาก jsdelivr เอง

โดยค่าเริ่มต้น ไฟล์เหล่านี้ถูกดึงมาจาก `process.env.CACHE_HOST` (ซึ่งมีค่าเริ่มต้นเป็น `https://cdn.jsdelivr.net`) เปลี่ยนได้โดยตั้งตัวแปร `CACHE_HOST` ตอนรันเซิร์ฟเวอร์

### แก้ปัญหา

ไฟล์จะถูกดาวน์โหลดจาก `CACHE_HOST` เข้าไปใน Redis ตอนเริ่มระบบ แล้วรีเฟรชทุกชั่วโมง ถ้า endpoint ของไฟล์ตอบว่า `Asset not cached yet` แปลว่าการดาวน์โหลดยังไม่เกิดขึ้น ให้ตรวจสอบว่า:

- ตั้ง `ENABLE_ASSETS_SERVER=true` ไว้ที่คอนเทนเนอร์ Cap จริงหรือไม่ ถ้าคุณแก้ในไฟล์ compose ให้สร้างคอนเทนเนอร์ใหม่ หากไม่ได้ตั้งค่านี้ endpoint `/assets/*` จะตอบ 404 พร้อมอธิบายว่า asset server ถูกปิดอยู่
- คอนเทนเนอร์ออกอินเทอร์เน็ตไปยัง `CACHE_HOST` ได้หรือไม่ ถ้าดาวน์โหลดล้มเหลว เซิร์ฟเวอร์จะบันทึกบรรทัดที่มีข้อความ `[asset server] failed to update assets cache` ตอนเริ่มระบบ แล้วลองใหม่ทุกชั่วโมง
- `WIDGET_VERSION` และ `WASM_VERSION` ชี้ไปยังเวอร์ชันที่มีอยู่จริงบน npm หรือไม่

## การจำกัดอัตราคำขอ

endpoint ของ challenge ถูกจำกัดอัตราตาม IP ของไคลเอนต์ด้วยหน้าต่างเวลาแบบคงที่ ค่าเริ่มต้นคือ 30 คำขอทุก 5 วินาที คุณเปลี่ยนค่าจำกัดรวมได้ที่ **Settings** ในแดชบอร์ด (หรือผ่าน `PUT /settings/ratelimit`) และกำหนดทับรายคีย์ได้ในแท็บ **Configuration** ของคีย์นั้น เมื่อเกินขีดจำกัด คำขอจะได้รับการตอบกลับ `429` พร้อมเฮดเดอร์ `X-RateLimit-Remaining: 0`

endpoint `/siteverify` มีไว้ใช้แบบเซิร์ฟเวอร์ถึงเซิร์ฟเวอร์ จึงไม่ถูกจำกัดอัตราโดยค่าเริ่มต้น

### IP ของไคลเอนต์เมื่ออยู่หลังพร็อกซี

Standalone ระบุตัวไคลเอนต์โดยดูเฮดเดอร์ `X-Forwarded-For`, `X-Real-IP` และ `CF-Connecting-IP` (ตามลำดับนี้) แล้วค่อยถอยไปใช้ที่อยู่ของซ็อกเก็ต ถ้าคุณอยู่หลัง reverse proxy ที่ใช้เฮดเดอร์อื่น ให้ตั้ง `RATELIMIT_IP_HEADER` ใน env ของคุณ (หรือกำหนดเฮดเดอร์ IP ที่ **Settings > Headers** ในแดชบอร์ด) เช่น ถ้าอยู่หลัง Cloudflare คุณอาจตั้งเป็น `cf-connecting-ip`

ตรวจให้แน่ใจว่าพร็อกซีของคุณส่งต่อ IP ของไคลเอนต์จริง ๆ สำหรับ nginx:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

ถ้าไม่ทำแบบนี้ ทุกคำขอจะดูเหมือนมาจาก IP ของพร็อกซีเอง และไคลเอนต์ทั้งหมดจะใช้โควตาจำกัดอัตราร่วมกันถังเดียว อีกทั้งพึงทราบว่า `X-Forwarded-For` ถูกเชื่อถือตามที่ส่งมา เซิร์ฟเวอร์จึงต้องไม่เปิดให้เข้าถึงตรงจากอินเทอร์เน็ต ไม่เช่นนั้นไคลเอนต์จะปลอมเฮดเดอร์เพื่อเลี่ยงการจำกัดอัตราได้

## Redis / Valkey

Cap Standalone ใช้ Redis (หรือ Valkey) สำหรับการเก็บข้อมูลทั้งหมด ให้ตั้งตัวแปรสภาพแวดล้อม `REDIS_URL` เป็นสตริงเชื่อมต่อ Redis ของคุณ ค่าเริ่มต้นคือ `redis://localhost:6379`

การตั้งค่าที่เราแนะนำใช้ Valkey (ที่เก็บข้อมูลซึ่งเข้ากันได้กับ Redis) ผ่านไฟล์ docker-compose ใน[คู่มือเริ่มต้นใช้งาน](/th/guide/standalone/)

ถ้าคุณใช้ Redis อินสแตนซ์เดียวร่วมกันหลาย Cap (หรือร่วมกับแอปอื่น) ให้ตั้ง `REDIS_PREFIX` เพื่อแยก namespace ของคีย์ทั้งหมด เช่น `REDIS_PREFIX=cap:` จะเก็บ session เป็น `cap:session:...` และเก็บ metric เป็น `cap:metrics:...` เป็นต้น ค่าเริ่มต้นคือว่าง ระบบที่ใช้งานอยู่แล้วจึงไม่ได้รับผลกระทบ

## การตรวจสุขภาพและการปิดระบบ {#health-checks-and-shutdown}

Cap Standalone มีเอนด์พอยต์สองตัวที่ไม่ต้องยืนยันตัวตน สำหรับระบบ orchestration และการมอนิเตอร์สถานะ:

- `GET /health` ตอบ `200 {"status":"ok"}` เมื่อ Redis ตอบ `PING` ภายใน 2 วินาที และตอบ `503 {"status":"unavailable"}` ในกรณีอื่น ใช้สำหรับ readiness check และการแจ้งเตือน
- `GET /health/live` ตอบ `200` ตราบใดที่โปรเซสยังทำงานอยู่ แม้ Redis จะล่ม ใช้สำหรับ liveness check เพื่อไม่ให้ระบบ orchestration รีสตาร์ต Cap วนซ้ำระหว่างที่ Redis มีปัญหา

การตรวจที่เข้ามาภายในวินาทีเดียวกันจะใช้ `PING` ร่วมกันครั้งเดียว การเรียก `/health` บ่อย ๆ จึงไม่เพิ่มภาระให้ Redis

ใน Kubernetes:

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 3000
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
```

ถ้าใช้ Docker Compose ให้เพิ่มส่วนนี้ในเซอร์วิส `cap` ส่วน Docker อย่างเดียวจะแค่ทำเครื่องหมายว่าคอนเทนเนอร์ unhealthy แต่จะไม่รีสตาร์ตให้

```yaml
healthcheck:
  test: ["CMD", "bun", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3
```

เมื่อได้รับ `SIGTERM` หรือ `SIGINT` Cap จะหยุดรับการเชื่อมต่อใหม่ รอให้คำขอที่กำลังทำงานอยู่เสร็จ ปิดการเชื่อมต่อ Redis แล้วออกด้วยรหัส 0 ถ้าผ่านไป 8 วินาทีแล้วยังมีคำขอทำงานอยู่ Cap จะออกด้วยรหัส 1 ทันที จึงจบได้ภายในเวลาหยุดเริ่มต้น 10 วินาทีของ Docker เสมอ ถ้าได้รับสัญญาณครั้งที่สองจะออกทันที

## ข้อความแสดงข้อผิดพลาด

ข้อความแสดงข้อผิดพลาดจะถูกปิดบังโดยค่าเริ่มต้น และบันทึกลงคอนโซลแทน หากต้องการปิดการบันทึกข้อผิดพลาด ให้ตั้ง `DISABLE_ERROR_LOGGING=true` และหากต้องการปิดการปิดบังข้อความ ให้ตั้ง `SHOW_ERRORS=true`

## พิสูจน์การทำงาน HashWX {#hashwx-proof-of-work}

Standalone ใช้ [HashWX](../hashwx.md) ซึ่งเป็น proof of work ที่ต้านทาน GPU เป็นโปรโตคอล challenge เริ่มต้นสำหรับคีย์ที่สร้างใหม่ มันตั้งค่าแยกรายคีย์ ดังนั้นบางคีย์จะใช้ SHA-256 ขณะที่คีย์อื่นยังอยู่กับ HashWX ก็ได้ ส่วนคีย์ที่สร้างก่อน HashWX จะกลายเป็นค่าเริ่มต้นนั้นจะคงโปรโตคอลเดิมไว้จนกว่าคุณจะเปลี่ยนเอง

วิธีเปลี่ยนโปรโตคอลคือเปิดแท็บ **Configuration** ของคีย์นั้น แล้วเลือกตัวที่ต้องการใต้ **Challenge protocol** HashWX ไม่ต้องตั้งค่าอะไรเลย: ไม่มีคู่กุญแจให้สร้างหรือให้เก็บรักษา

ระดับความยากควบคุมด้วยแถบเลื่อน **HashWX difficulty** ซึ่งคือจำนวนครั้งที่คาดว่าไคลเอนต์ต้องแฮช ค่าเริ่มต้นคือ `1_000_000` แบ่งเป็นสี่ challenge ย่อย ซึ่งวัดค่ามัธยฐานได้ 578 มิลลิวินาทีบนเดสก์ท็อป 8 คอร์ใน Chrome และ 1.1 ถึง 5.9 วินาทีบนโทรศัพท์ ดู[ผลการวัดบนโทรศัพท์](../hashwx.md#phones)ก่อนจะเพิ่มค่านี้ ช่วงที่ใช้ได้คือ `50_000`-`5_000_000`

ไคลเอนต์ที่ไม่มี WebAssembly แก้ HashWX ไม่ได้ ถ้าคุณต้องรองรับพวกเขา ให้เปลี่ยนคีย์นั้นไปใช้ proof of work แบบ SHA-256 แทน ซึ่งมีทางถอยเป็น JS ล้วน

ปริศนา time-lock แบบ RSW ยังเลือกใช้ได้สำหรับระบบที่ติดตั้งไว้แล้ว แต่มันถูกเลิกใช้แล้ว: GPU เคลียร์มันได้ต่อวินาทีมากกว่า CPU ราว 170 เท่า จึงไม่ได้ให้ความต้านทาน GPU อย่างที่ตั้งใจไว้ตอนเพิ่มเข้ามา แถบเลื่อน **RSW difficulty** กำหนดค่า `t` ซึ่งคือจำนวนครั้งที่ต้องยกกำลังสองตามลำดับ ในช่วง `10_000`-`300_000` และ `RSW_BITS=2048` ใช้กำหนดขนาดมอดุลัสทับตอนบูต

::: tip
ตัววิดเจ็ตตรวจจับโปรโตคอลได้เองจากรูปแบบข้อมูล การสลับคีย์จึงเป็นสิ่งเดียวที่คุณต้องทำ ส่วนนอก Standalone นั้น cap-core ยังใช้ PoW แบบ SHA-256 เป็นค่าเริ่มต้นอยู่ เว้นแต่คุณจะเลือกเปิดเอง
:::

## challenge แบบ instrumentation

Cap Standalone รองรับ challenge แบบ JavaScript instrumentation เพื่อรับมือกับตัวแก้ proof-of-work พร้อมตัวเลือกสำหรับสกัดเบราว์เซอร์แบบ headless ไม่ให้แก้ผ่าน โดย challenge แบบ instrumentation จะเปิดใช้งานเป็นค่าเริ่มต้นเมื่อสร้าง site key ใหม่

คุณเปิดหรือปิด challenge แบบ instrumentation ได้ในหน้าตั้งค่าของ site key และหากต้องการสกัดเบราว์เซอร์ headless ให้เปิด "Attempt to block headless browsers" ในการตั้งค่าของคีย์

พึงทราบว่าระดับ instrumentation ที่สูงอาจลดอัตราการสร้างลงอย่างมาก เราแนะนำให้คงไว้ที่ระดับ 3 เว้นแต่คุณต้องการการทำให้อ่านยากที่เข้มขึ้น ถ้าพบว่าระดับ 3 ช้าเกินไป ระดับ 1 จะเร็วกว่ามากบนคอร์เดียว

## ฐานข้อมูล IP

การค้นหาประเทศและ ASN เลือกใช้ผู้ให้บริการได้สามราย ตั้งค่าได้ที่ `Settings > IP Data > Country & ASN data` ในแดชบอร์ด ได้แก่ DB-IP Lite, MaxMind GeoLite2 และ API ของ IPInfo

สำหรับ DB-IP และ MaxMind ไฟล์ `.mmdb` จะถูกดาวน์โหลดไปไว้ที่ `/usr/src/app/data/` ภายในคอนเทนเนอร์

### สิทธิ์ของ Docker volume

คอนเทนเนอร์รันด้วยผู้ใช้ที่ไม่มีสิทธิ์พิเศษชื่อ `bun` (UID 1000) ถ้าคุณ bind-mount ไดเรกทอรีของเครื่องโฮสต์ไปที่ `/usr/src/app/data` ไดเรกทอรีนั้นต้องเขียนได้โดย UID 1000 ไม่เช่นนั้นการดาวน์โหลดจะล้มเหลวด้วย `EACCES: permission denied`

```bash
mkdir -p ./cap-data
sudo chown 1000:1000 ./cap-data
```

```yaml
services:
  cap:
    image: tiago2/cap:latest
    volumes:
      - ./cap-data:/usr/src/app/data
    # ...
```

ถ้าคุณเปลี่ยนเจ้าของไฟล์บนเครื่องโฮสต์ไม่ได้ (บางแพลตฟอร์มอย่าง Coolify ทำเรื่องนี้ได้ลำบาก) ทางเลือกที่ง่ายที่สุดคือ:

- ไม่ต้อง bind mount เลย ปล่อยให้ Docker จัดการไดเรกทอรีข้อมูลเอง เพราะอิมเมจสร้างมันไว้ให้พร้อมสิทธิ์ที่ถูกต้องอยู่แล้ว
- ใช้ named volume แทน bind mount
- เปลี่ยนไปใช้ผู้ให้บริการข้อมูล IP ที่ไม่ต้องมีไฟล์ในเครื่อง
