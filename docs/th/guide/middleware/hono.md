---
description: "เพิ่ม Cap Checkpoint ให้แอป Hono ด้วย @cap.js/checkpoint-hono ปกป้องเส้นทางต่าง ๆ ด้วย CAPTCHA แบบ proof-of-work โอเพนซอร์สที่โฮสต์เองได้ พร้อมการตรวจสอบเบราว์เซอร์"
---

# Checkpoint สำหรับ Hono

## การติดตั้ง

```bash
bun add hono @cap.js/checkpoint-hono
```

## วิธีใช้งาน

```javascript
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { capCheckpoint } from "@cap.js/checkpoint-hono";

const app = new Hono();

app.use(
  "*",
  capCheckpoint({
    token_validity_hours: 32, // token มีอายุนานเท่าใด
    tokens_store_path: ".data/tokensList.json",
    token_size: 16, // ขนาด token เป็นไบต์
    verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
  }),
);

app.get("/", (c) => c.text("Hello Hono!"));

export default app;
```

เท่านี้ก็เรียบร้อย! ตอนนี้คุณใช้มิดเดิลแวร์นี้ปกป้องเส้นทางต่าง ๆ ของคุณได้แล้ว
