---
description: "capd คือวิธีที่ง่ายที่สุดในการโฮสต์แบ็กเอนด์ของ CAPTCHA โอเพนซอร์สตัวนี้เอง ใช้คอนเทนเนอร์ Docker หนึ่งตัวพร้อมแดชบอร์ด site key หลายชุด และ API ที่เข้ากันได้กับ reCAPTCHA"
---

# capd

capd คือเซิร์ฟเวอร์ Cap ในรูปแบบอิมเมจ Docker มันส่ง challenge ให้วิดเจ็ต ตรวจสอบ token ให้แบ็กเอนด์ของคุณ และมีแดชบอร์ดสำหรับ site key เหตุการณ์สด กฎ รายการ และการตั้งค่า มันรันบน Bun ใช้หน่วยความจำขณะว่างราว 30 MB และเก็บข้อมูลไว้ใน Valkey โดยเก็บเหตุการณ์สำหรับสถิติไว้ใน DuckDB หรือ ClickHouse

เดโมด้านล่างคือแดชบอร์ดจริงที่ทำงานในเบราว์เซอร์ของคุณด้วยทราฟฟิกที่สร้างขึ้น

<DashboardDemo compact activating="กำลังเปิดการเลื่อน..." />

หากต้องการรันทั้งระบบรวมถึงแดชบอร์ดบน Cloudflare โดยไม่ต้องมีเซิร์ฟเวอร์ ดูที่ [Cloudflare Workers](./workers.md) ถ้าคุณต้องการแค่ challenge ภายในบริการที่มีอยู่แล้ว [core library](../capjs-core.md) ทำได้โดยไม่มีแดชบอร์ด

## การรัน {#running-it}

[คู่มือเริ่มต้นใช้งาน](../index.md#_1-set-up-capd)จะดาวน์โหลดไฟล์ compose และเริ่ม Cap ทุกการติดตั้งต้องใช้ Valkey เพื่อเก็บ site key การตั้งค่า และ session ส่วนเหตุการณ์สำหรับสถิติจะเก็บไว้ใน DuckDB หรือ ClickHouse

`ADMIN_KEY` คือค่าเดียวที่คุณต้องตั้ง มันคือรหัสผ่านแดชบอร์ด และเซิร์ฟเวอร์จะไม่เริ่มทำงานถ้าไม่มีค่านี้หรือถ้าสั้นกว่า 12 ตัวอักษร ตัวเลือกอื่น ๆ อยู่ใน[การตั้งค่า](./options.md)

หากต้องการอัปเดต ให้ดึงอิมเมจใหม่และสร้างคอนเทนเนอร์ใหม่:

```bash
docker compose pull && docker compose up -d
```

## การเก็บข้อมูลสถิติ {#analytics-storage}

DuckDB เป็นไฟล์ที่อยู่ในคอนเทนเนอร์ Cap จึงไม่ต้องมีคอนเทนเนอร์เพิ่ม ส่วน ClickHouse รันเป็นคอนเทนเนอร์ของตัวเองข้าง ๆ Cap และให้คอนเทนเนอร์ Cap หลายตัวใช้ประวัติเหตุการณ์ชุดเดียวกันได้

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

ไฟล์ DuckDB จะรัน Cap และ Valkey โดย Cap เขียนเหตุการณ์ลงใน `/usr/src/app/data/events.duckdb` บน volume `cap-data` DuckDB ใช้หน่วยความจำไม่เกิน 256 MB และใช้ 2 เธรด ซึ่งเปลี่ยนได้ด้วย `DUCKDB_MEMORY_LIMIT` และ `DUCKDB_THREADS` ส่วนไฟล์ ClickHouse จะรัน Cap, Valkey และ ClickHouse โดย ClickHouse ใช้ `ADMIN_KEY` เป็นรหัสผ่านของผู้ใช้ `cap` และไม่เปิดพอร์ตออกมา จึงไม่มีอะไรต้องตั้งเพิ่ม การตั้งค่าของมันปิดตาราง log ระบบของ ClickHouse เองและจำกัดหน่วยความจำไว้ที่ 1 GB

| | DuckDB | ClickHouse |
| --- | --- | --- |
| คอนเทนเนอร์เพิ่มเติม | ไม่มี | มี |
| หน่วยความจำของที่เก็บข้อมูล | สูงสุด 256 MB ขณะที่แดชบอร์ดคิวรี | ราว 150 MB ขณะว่าง |
| คอนเทนเนอร์ Cap หลายตัว | แต่ละตัวเก็บประวัติของตัวเอง | ใช้ประวัติเหตุการณ์ร่วมกัน |

ถ้ารหัสผ่านของคุณมีช่องว่าง `#` หรือ `$` ให้ครอบด้วยเครื่องหมายคำพูดเดี่ยวใน `.env`

### ใช้ ClickHouse ของคุณเอง {#your-own-clickhouse}

ใช้ไฟล์ compose ของ DuckDB แล้วเพิ่ม `CLICKHOUSE_URL` ลงใน `.env`:

```dotenv
CLICKHOUSE_URL=http://cap:password@clickhouse.internal:8123/cap
```

Cap สร้างฐานข้อมูลและตารางเมื่อเริ่มทำงานครั้งแรก ผู้ใช้ต้องมีทุกสิทธิ์บนฐานข้อมูลนั้นและสิทธิ์ `SELECT` บน `system.parts` ถ้าเชื่อมต่อ ClickHouse ไม่ได้ตอนเริ่มทำงาน Cap จะเก็บเหตุการณ์ไว้ใน DuckDB จนกว่าจะรีสตาร์ต และแสดงข้อผิดพลาดที่ **Instance settings > Data and storage**

### การอัปเกรดจากรีลีสก่อนหน้า {#upgrading-from-an-earlier-release}

ไฟล์ compose ก่อนที่จะมีสถิติไม่มี volume สำหรับ `/usr/src/app/data` ดังนั้น Docker จะให้ volume แบบไม่มีชื่อแก่โฟลเดอร์นั้น และเหตุการณ์จะสูญหายทุกครั้งที่สร้างคอนเทนเนอร์ใหม่ เพิ่ม volume `cap-data` จาก `docker-compose.duckdb.yml` เพื่อเก็บข้อมูลไว้

### Secret, API key และเซสชันจากรีลีสก่อนหน้า {#secrets-api-keys-and-sessions-from-older-releases}

รีลีสก่อนหน้าแฮช secret ของ site key, API key และเซสชันของแดชบอร์ดด้วย argon2 ตอนนี้ Cap เก็บทั้งหมดเป็น SHA-256 เพราะแต่ละอย่างเป็นโทเค็นสุ่มขนาด 240 บิตขึ้นไป และจะปฏิเสธแฮชแบบเก่าแทนที่จะตรวจสอบมัน เมื่อเริ่มทำงานครั้งแรกหลังอัปเกรด:

- ทุกคนจะถูกออกจากระบบแดชบอร์ด ให้เข้าสู่ระบบใหม่ด้วย `ADMIN_KEY`
- `/siteverify` ตอบ 403 สำหรับคีย์ที่ secret สร้างโดยรีลีสก่อนหน้า หน้า **Settings** ของคีย์เหล่านั้นจะแจ้งไว้ ให้รีเซ็ต secret ที่ **Danger zone** แล้วนำค่าใหม่ไปใส่ในสภาพแวดล้อมของแบ็กเอนด์
- API key จากรีลีสก่อนหน้าจะได้รับ 401 **Settings > API keys** จะทำเครื่องหมายไว้ ให้สร้างอันใหม่และลบอันเก่า

Cap บันทึก id ของ site key และ API key ที่ยังต้องดำเนินการนี้ไว้ในล็อกตอนเริ่มทำงาน ให้รีเซ็ต secret ก่อนอัปเดตแบ็กเอนด์ที่เรียก `/siteverify` เพราะคำขอที่ใช้ secret เก่าจะล้มเหลวตั้งแต่อิมเมจใหม่เริ่มทำงาน

## การเปิดให้เข้าถึงจากอินเทอร์เน็ต {#putting-it-online}

วิดเจ็ตเรียก Cap จากเบราว์เซอร์ของผู้เข้าชม ดังนั้นเซิร์ฟเวอร์ต้องมี HTTPS URL สาธารณะ วางมันไว้หลัง reverse proxy ที่คุณใช้ตามปกติ และอย่าเปิดพอร์ต 3000 ให้อินเทอร์เน็ตเข้าถึง

Cap จำกัดอัตราคำขอ challenge ตาม IP ของไคลเอนต์ ซึ่งจะทำงานได้ก็ต่อเมื่อมันเห็น IP จริง อ่านเรื่อง [IP ของไคลเอนต์เมื่ออยู่หลังพร็อกซี](./options.md#client-ips-behind-a-proxy)ก่อนเปิดใช้งานจริง ไม่เช่นนั้นผู้เข้าชมทุกคนจะใช้โควตาจำกัดอัตราร่วมกัน

โหมด Live ในหน้า Events ใช้ WebSocket ที่ `/server/live` พร็อกซีส่วนใหญ่ส่งต่อให้ได้เลย ถ้าใช้ nginx ให้เพิ่ม `proxy_http_version 1.1` และเฮดเดอร์ `Upgrade` กับ `Connection` ใน location ของ Cap ถ้าไม่มี แดชบอร์ดจะเปลี่ยนไปตรวจทุก 4 วินาทีแทน

## Site key {#site-keys}

site key แต่ละชุดมี secret สถิติ และการตั้งค่าของตัวเอง ได้แก่โปรโตคอลและความยากของ challenge, [instrumentation](../instrumentation.md), การจำกัดอัตราคำขอ และกฎการบล็อก คีย์ใหม่ใช้ [HashWX](../hashwx.md) โดยเปิด instrumentation ไว้

คุณเปิดดูหรือคัดลอก secret อีกครั้งได้ที่ **Add Cap to your site** ในหน้า **Settings** ของคีย์ ถัดจากตัวอย่าง `.env` ที่มีคีย์ทั้งสองตัว ส่วนการรีเซ็ตอยู่ที่ **Danger zone** Cap เข้ารหัส secret ด้วยคีย์ที่สร้างจาก `ADMIN_KEY` ดังนั้นสำเนาข้อมูล Valkey เพียงอย่างเดียวจึงไม่เปิดเผย secret การเปลี่ยน `ADMIN_KEY` ทำให้อ่าน secret ที่เก็บไว้ไม่ได้ หลังจากนั้นให้รีเซ็ต secret เพื่อรับค่าใหม่ที่เปิดดูได้อีกครั้ง

## ความยากแบบปรับได้ {#adaptive-difficulty}

กฎที่ใช้แอ็กชัน **Harder puzzle** จะคูณความยากของคีย์สำหรับคำขอที่ตรงกับกฎ ตั้งแต่ 1.5 ถึง 10 เท่า หรือ 2 เท่าถ้าคุณไม่ได้เลือกตัวคูณ คีย์ HashWX จะเพิ่มความยาก ส่วนคีย์ SHA-256 จะเพิ่มจำนวน challenge ได้สูงสุด 500 กฎจับคู่ได้จากจำนวน challenge ต่อนาทีของ IP หรือผู้เข้าชม ประเทศ เครือข่าย user agent เฮดเดอร์ และรายการที่ใช้ร่วมกัน ผู้เข้าชมที่ขอซ้ำถี่ ๆ หรือเครือข่ายที่คุณไม่ไว้ใจจึงต้องจ่ายมากขึ้น ขณะที่คนอื่นแก้โจทย์ตามปกติ

เทมเพลต **Harder puzzles for fast repeat visitors** จะให้โจทย์ยากขึ้น 4 เท่ากับ IP ที่ขอ challenge เกิน 20 ครั้งต่อนาที หน้า Events จะแสดงคำขอเหล่านี้เป็น **Puzzle ×4**

## Endpoint {#endpoints}

สำหรับ site key `abc123` บน `cap.example.com`:

| URL | ผู้เรียกใช้ |
| --- | --- |
| `https://cap.example.com/abc123/` | วิดเจ็ต ผ่าน `data-cap-api-endpoint` |
| `https://cap.example.com/abc123/siteverify` | แบ็กเอนด์ของคุณ พร้อม secret และ token |
| `https://cap.example.com/` | คุณ เพื่อใช้แดชบอร์ด |

`/siteverify` รับ JSON ที่มี `secret` และ `response` เช่นเดียวกับของ reCAPTCHA และคืนค่า `{ "success": true }` สำหรับ token ที่ถูกต้อง หากตรวจสอบไม่ผ่านจะคืนค่า `success: false` พร้อมข้อความ `error` และสถานะ 4xx token ใช้ได้ครั้งเดียว

แดชบอร์ดยังมี [REST API](./options.md#api) สำหรับจัดการคีย์ผ่านสคริปต์
