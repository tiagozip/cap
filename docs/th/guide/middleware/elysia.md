---
description: "เพิ่ม Cap Checkpoint ให้แอป Elysia ด้วยมิดเดิลแวร์อย่างเป็นทางการ ปกป้องเส้นทางต่าง ๆ ด้วย CAPTCHA แบบ proof-of-work โอเพนซอร์สที่โฮสต์เองได้ ในโค้ดไม่กี่บรรทัด"
---

# Checkpoint สำหรับ Elysia

## การติดตั้ง

```bash
bun add elysia @cap.js/middleware-elysia
```

> [!NOTE] เทมเพลตเพียงต้องมีวิดเจ็ตหรือ solver แบบซ่อนที่ชี้ไปยัง URL `/__cap_clearance` ดูเทมเพลตตัวอย่างได้[ที่นี่](https://github.com/tiagozip/cap/blob/main/checkpoints/elysia/index.html)

## วิธีใช้งาน

```javascript
import { Elysia, file } from "elysia";
import { capMiddleware } from "@cap.js/middleware-elysia";

new Elysia()
  .use(
    capMiddleware({
      token_validity_hours: 32, // token มีอายุนานเท่าใด
      tokens_store_path: ".data/tokensList.json",
      token_size: 16, // ขนาด token เป็นไบต์
      verification_template_path: join(dirname(fileURLToPath(import.meta.url)), "./index.html"),
      scoping: "scoped", // 'global' | 'scoped'
    }),
  )
  .get("/", () => "Hello Elysia!")
  .listen(3000);
```

เท่านี้ก็เรียบร้อย! ตอนนี้คุณใช้มิดเดิลแวร์นี้ปกป้องเส้นทางต่าง ๆ ของคุณได้แล้ว
