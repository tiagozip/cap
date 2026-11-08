---
description: "โหมดล่องหนของ Cap: เรียก new Cap() และ solve() เพื่อรัน CAPTCHA โอเพนซอร์สจาก JavaScript ของคุณเอง พร้อม proof-of-work และไม่ต้องแสดงวิดเจ็ต"
---

# โหมดล่องหน {#invisible}

โหมดล่องหนแก้ challenge จากโค้ดของคุณเองโดยไม่แสดงอะไรบนหน้า เหมาะกับการกระทำที่ไม่มีฟอร์ม เช่น ปุ่มถูกใจหรือคำขอที่ทำงานเบื้องหลัง

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://cap.example.com/<site-key>/" });
const { token } = await cap.solve();
```

เมื่อใช้สคริปต์จาก CDN `Cap` จะเป็นตัวแปร global และไม่ต้อง import

## API

### `new Cap(config, element?)`

ต้องระบุ `config.apiEndpoint` เว้นแต่คุณตั้ง [`CAP_CUSTOM_FETCH`](./widget.md#options) ไว้ คีย์อื่น ๆ จะถูกตั้งเป็นแอตทริบิวต์บนวิดเจ็ต จึงใช้[แอตทริบิวต์ของวิดเจ็ต](./widget.md#attributes)ที่นี่ได้ด้วย:

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

หากไม่ส่ง `element` Cap จะสร้าง `<cap-widget>` แบบซ่อนที่ปิดการสั่นไว้ วิดเจ็ตที่ซ่อนจะไม่ขอหรือแก้ challenge ล่วงหน้า งานทั้งหมดจึงเกิดขึ้นเมื่อคุณเรียก `solve()` หากต้องการควบคุมวิดเจ็ตที่มีอยู่แล้ว ให้ส่งวิดเจ็ตนั้นเข้ามา

### `cap.solve()`

ขอและแก้ challenge โดย resolve เป็น `{ success, token }`

เมื่อล้มเหลว จะส่งเหตุการณ์ `error` และ reject promise ด้วย `Error` ที่มี `code` เป็นหนึ่งใน[รหัสข้อผิดพลาด](./error-codes.md) เช่น `instr_csp_blocked` สำหรับ[เฟรมที่ถูกบล็อก](./widget.md#content-security-policy):

```js
try {
  const { token } = await cap.solve();
} catch (err) {
  console.error(err.code, err.message);
}
```

หากเรียกขณะกำลังแก้ challenge อยู่ จะ resolve เป็น `undefined`

### `cap.token`

คืนค่า token จากการแก้ครั้งล่าสุด หรือ `null`

### `cap.reset()`

ล้าง token

### `cap.addEventListener(type, listener)`

ดักฟัง[เหตุการณ์](./widget.md#events)ของวิดเจ็ต:

```js
cap.addEventListener("progress", (e) => {
  console.log(`${e.detail.progress}%`);
});
```

## คีย์ที่ให้คะแนนพฤติกรรม {#keys-with-behavior-scoring}

การแก้ในโหมดล่องหนไม่มีการคลิกวิดเจ็ต บนคีย์ที่[ให้คะแนนพฤติกรรม](./instrumentation.md#behavior-scoring) ผลตัดสินจะเป็น `no_interaction` จึงล้มเหลวบนคีย์ที่เปิดการบล็อกและกำหนดให้ต้องมีการโต้ตอบ ในไลบรารี core ให้ตั้ง `requireInteraction: false` ในนโยบาย `behavior` สำหรับ route เหล่านั้น
