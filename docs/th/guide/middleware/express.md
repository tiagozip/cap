---
description: "เพิ่ม Cap Checkpoint ให้ Express ด้วย @cap.js/checkpoint-express ปกป้องเส้นทางต่าง ๆ ด้วย CAPTCHA แบบ proof-of-work โอเพนซอร์สที่โฮสต์เองได้ พร้อมการตรวจสอบเบราว์เซอร์"
---

# Checkpoint สำหรับ Express

## การติดตั้ง

```bash
bun add express cookie-parser @cap.js/checkpoint-express
```

## วิธีใช้งาน

```javascript
import express from "express";
import cookieParser from "cookie-parser";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { capCheckpoint } from "@cap.js/checkpoint-express";

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(cookieParser());

app.use(
  capCheckpoint({
    /*
      token_validity_hours: 32,
      tokens_store_path: ".data/tokensList.json",
      token_size: 16,
      verification_template_path: join(__dirname, "./index.html"),
    */
  }),
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "success.html"));
});

app.listen(3000, () => {
  console.log(`Server running on http://localhost:3000`);
});
```

เท่านี้ก็เรียบร้อย! ตอนนี้คุณใช้มิดเดิลแวร์นี้ปกป้องเส้นทางต่าง ๆ ของคุณได้แล้ว
