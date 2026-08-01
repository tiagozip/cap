---
description: "โหมด programmatic ของ Cap: เรียก new Cap() และ solve() เพื่อรัน CAPTCHA โอเพนซอร์สจาก JavaScript ของคุณเอง พร้อม proof-of-work และไม่ต้องแสดงวิดเจ็ต"
---

# โหมด programmatic

คุณสามารถใช้ `new Cap({ ... })` ใน JavaScript ฝั่งไคลเอนต์เพื่อสร้างอินสแตนซ์ Cap ใหม่ แล้วใช้เมธอด `solve()` เพื่อแก้ challenge

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // หรือ: apiEndpoint: "/api/",
});
const solution = await cap.solve();

console.log(solution.token);
```

คุณตั้ง [event listener](widget.md#เหตุการณ-ท-รองร-บ) ได้ด้วย:

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // หรือ: apiEndpoint: "/api/",
});

cap.addEventListener("progress", (event) => {
  console.log(`กำลังแก้... เสร็จแล้ว ${event.detail.progress}%`);
});
```

เบื้องหลังนั้น Cap จะสร้างอิลิเมนต์ `cap-widget` แบบซ่อนไว้ แล้วใช้มันแก้ challenge

## เมธอดและอาร์กิวเมนต์ที่รองรับ

เมธอดที่รองรับมีดังนี้:

#### `new Cap({ ... })`

สร้างอินสแตนซ์ Cap ใหม่ ถ้าส่งอาร์กิวเมนต์ตัวที่สองเข้ามา Cap จะใช้อิลิเมนต์นั้นแทนการสร้างใหม่ในหน่วยความจำ

**อาร์กิวเมนต์**

```json
{
  apiEndpoint: ..., // API endpoint เทียบเท่ากับแอตทริบิวต์ `data-cap-api-endpoint` ของวิดเจ็ต
  workers: navigator.hardwareConcurrency || 8 // จำนวน worker thread ที่จะใช้
}
```

#### `cap.solve()`

ขอและแก้ challenge

**ผลลัพธ์:** `{ token }`

#### `cap.token`

คืนค่า token จากการแก้ครั้งล่าสุด

#### `cap.reset()`

รีเซ็ต `cap.token`

#### `cap.addEventListener(..., function () { ... })`

ดักฟังเหตุการณ์ของวิดเจ็ต Cap ดู[เหตุการณ์ที่รองรับ](widget.md#เหตุการณ-ท-รองร-บ)
