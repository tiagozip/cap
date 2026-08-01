---
description: "@cap.js/solver แก้ challenge แบบ proof-of-work ของ Cap ฝั่งเซิร์ฟเวอร์บน Bun สำหรับงานแบบเครื่องคุยกับเครื่อง เป็นชิ้นส่วนเล็ก ๆ ที่ไม่มี dependency ของ CAPTCHA โอเพนซอร์สตัวนี้"
---

# M2M

`@cap.js/solver` เป็นไลบรารีแยกต่างหากที่ใช้แก้ challenge ของ Cap จากฝั่งเซิร์ฟเวอร์ได้ มันเรียบง่ายมาก (ไม่มี dependency ไฟล์เดียวจบ) แต่เร็วและมีประสิทธิภาพเทียบเท่าวิดเจ็ต ทั้งนี้ **ใช้ได้กับ Bun เท่านั้น**

แพ็กเกจนี้ไม่ได้ข้าม proof-of-work จริงแต่อย่างใด และ **ไม่รองรับ challenge แบบ instrumentation**

## การติดตั้ง

```bash
bun add @cap.js/solver
```

## วิธีใช้งาน

#### จาก challenge แบบมี seed

```js
import solver from "@cap.js/solver";

console.log(
  await solver("challenge token", {
    c: 50, // จำนวน challenge
    s: 32, // ขนาด salt
    d: 4, // ระดับความยาก
  }),
);
```

#### จากรายการ challenge

```js
import solver from "@cap.js/solver";

const challenges = [
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455"],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff"],
  ["501350aa7c46573cb604284554045703", "4971"],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7"],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f"],
  /* ... */
];

console.log(await solver(challenges));
```

**ผลลัพธ์:**

```json
[67302, 64511, 40440, 27959, 71259 /* ... */]
```

อาร์กิวเมนต์ตัวที่สองเป็นตัวเลือก แต่ส่งเข้ามาได้เสมอ และเป็นอ็อบเจกต์เสมอ

- สำหรับ **challenge ทุกประเภท** `workerCount` ระบุจำนวน worker ที่จะใช้ (ค่าเริ่มต้นคือจำนวนคอร์ของ CPU)

- สำหรับ **challenge ทุกประเภท** ใช้ `onProgress` เพื่อกำหนด callback สำหรับรายงานความคืบหน้าได้ด้วย

- สำหรับ **challenge แบบมี seed เท่านั้น** อ็อบเจกต์นี้ใช้ระบุจำนวนคำตอบที่จะสร้าง ขนาดของ challenge และระดับความยาก
