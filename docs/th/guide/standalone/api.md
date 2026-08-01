---
description: "เอกสารอ้างอิง REST API ของ Cap Standalone: สร้างและจัดการ site key และ session ของ CAPTCHA โอเพนซอร์สที่โฮสต์เองได้ ผ่านคำขอที่ยืนยันตัวตนแบบ bearer"
---

# API

โหมด standalone มี API แบบเรียบง่ายสำหรับสร้าง ดู และจัดการ key กับ session ขั้นแรกให้เข้าสู่ระบบแดชบอร์ด Cap Standalone ของคุณ แล้วขอ API key ได้ที่ **Settings** → **API Keys** ตั้งชื่อให้มัน แล้วกด "Create"

เมื่อสร้าง key เสร็จแล้ว ให้เก็บไว้ในที่ปลอดภัย เพราะคุณจะดูมันอีกไม่ได้

จากนั้นคุณใช้ key นี้ส่งคำขอ API ไปยังเซิร์ฟเวอร์ standalone ของคุณได้ ทุกคำขอต้องแนบเฮดเดอร์ `Authorization` พร้อม API key ของคุณ แบบนี้:

```http
Authorization: Bot YOUR_API_KEY
```

ดูรายการ API endpoint ทั้งหมดที่ใช้ได้พร้อม body ที่ต้องส่ง ได้ที่ `http://localhost:3000/swagger`
