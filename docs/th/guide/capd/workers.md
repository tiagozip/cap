---
description: "รัน capd บน Cloudflare Workers ด้วย D1: โค้ด แดชบอร์ด site key และ siteverify API ชุดเดียวกัน โดยไม่ต้องดูแลเซิร์ฟเวอร์หรือคอนเทนเนอร์"
---

# Cloudflare Workers

การรองรับ Workers ยังเป็น**รุ่นทดลอง** ถ้าคุณเจอบั๊ก [แจ้งได้ที่นี่](https://github.com/tiagozip/cap/issues)

## การดีพลอย

คุณต้องมี Node 22 ขึ้นไป [Bun](https://bun.sh) สำหรับ build แดชบอร์ด และบัญชี Cloudflare

```bash
git clone https://github.com/tiagozip/cap.git
cd cap/workers && npm install
npm run deploy
npx wrangler secret put ADMIN_KEY
```

`npm run deploy` ติดตั้งแพ็กเกจของ capd, build แดชบอร์ด, ดีพลอย Worker แล้วจึงรัน migration ของ D1 เพราะ `wrangler deploy` สร้างฐานข้อมูลในครั้งแรก `ADMIN_KEY` คือรหัสผ่านของแดชบอร์ด สร้างได้ด้วย `openssl rand -hex 24`

เปิด URL `workers.dev` ที่ Wrangler แสดงแล้วเข้าสู่ระบบ ถ้าต้องการให้บริการบนโดเมนของคุณเอง ให้เพิ่ม [custom domain](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) ให้ Worker

เมื่อต้องการอัปเดต ให้ pull repository แล้วรันคำสั่งเดิมอีกครั้ง ยกเว้น `secret put`

## ต่างจากอิมเมจ Docker อย่างไร

- **การตั้งค่าใช้เวลาไม่กี่วินาทีจึงมีผลทุกที่** แต่ละ isolate โหลดการตั้งค่าใหม่ทุก 10 วินาที แคชคอนฟิกของคีย์และรายการต่างๆ ไว้ 5 วินาที และแคช CORS origin ของ siteverify ไว้ 60 วินาที
- **การ redeem ช้ากว่า** การเขียน D1 ทุกครั้งไปที่ภูมิภาคหลักของฐานข้อมูล และ redeem เขียนหลายครั้งต่อเนื่องกัน ผู้เข้าชมที่อยู่ไกลจากภูมิภาคหลักจึงต้องรอนานกว่า
- **การตั้งค่าฐานข้อมูล IP ถูกปิดไว้** เพราะ Cloudflare ส่งประเทศและ ASN ของผู้เข้าชมแต่ละคนให้ Worker อยู่แล้ว
- **ระดับ obfuscation 4 ถึง 10 ข้ามขั้นตอน minify** เพราะ esbuild รันใน Worker ไม่ได้ วิดเจ็ตยังแก้ challenge ด้วยวิธีเดิม
- **Webhook ลองส่งซ้ำหลังจาก 1 วินาทีและ 5 วินาที** ครั้งที่สามหลังจาก 30 วินาทีเกินเวลาที่ Cloudflare ให้ Worker หลังส่งคำตอบไปแล้ว จึงมักไม่ได้ทำงาน
- **โหมด Live ในหน้า Events ตรวจหาอีเวนต์ใหม่ทุก 4 วินาที** อิมเมจ Docker ส่งอีเวนต์ผ่าน WebSocket แต่ Worker กระจายข้อความไปยังหลายการเชื่อมต่อไม่ได้ถ้าไม่มี Durable Object
- **ไม่มีเอกสาร API ที่ `/swagger`** เอกสารของอิมเมจ Docker อธิบาย API ชุดเดียวกัน
- **ไม่มีการย้ายข้อมูลจากอิมเมจ Docker** site key การตั้งค่า และเหตุการณ์จะเริ่มต้นจากค่าว่าง

D1 รันคำสั่งของฐานข้อมูลหนึ่งทีละคำสั่ง เว็บไซต์ที่มีผู้ใช้มากจึงชนขีดจำกัดของฐานข้อมูลก่อน Worker นานมาก ถ้าเกินราว 50 ครั้งต่อวินาทีรวมทุก site key ให้ใช้อิมเมจ Docker แทน

## การรันในเครื่อง

```bash
cd workers && npm install
echo "ADMIN_KEY=$(openssl rand -hex 24)" > .dev.vars
npm run dev
```

`npm run dev` build แดชบอร์ด รัน migration กับฐานข้อมูลในเครื่อง แล้วเริ่ม `wrangler dev`
