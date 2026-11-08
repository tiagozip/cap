---
description: "โหมดลอยของวิดเจ็ต Cap จะซ่อน CAPTCHA โอเพนซอร์สไว้จนกว่าจะมีการกดปุ่ม แล้วค่อยรัน proof-of-work ตามต้องการ ตั้งค่าได้ด้วย data attribute เพียงตัวเดียว"
---

# โหมดลอย {#floating-mode}

โหมดลอยจะซ่อนวิดเจ็ตไว้จนกว่าจะมีคนกดปุ่ม จากนั้นวิดเจ็ตจะปรากฏข้างปุ่ม แก้ challenge ซ่อนตัวอีกครั้ง แล้วคลิกปุ่มซ้ำ ทำให้ปุ่มส่งฟอร์มส่งฟอร์มต่อไปพร้อม token ที่อยู่ในนั้น

โหลดสคริปต์โหมดลอยหลังวิดเจ็ต:

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>
```

บน[เซิร์ฟเวอร์แอสเซ็ต](./capd/options.md#asset-server)ของ capd สคริปต์โหมดลอยอยู่ที่ `/assets/floating.js`

จากนั้นระบุวิดเจ็ตให้ปุ่มด้วย CSS selector:

```html
<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

| แอตทริบิวต์ | หน้าที่ |
| --- | --- |
| `data-cap-floating` | selector ของวิดเจ็ตที่จะแสดง |
| `data-cap-floating-position` | ตำแหน่ง `top` หรือ `bottom` ของปุ่ม ค่าเริ่มต้นคือ `top` |
| `data-cap-floating-offset` | ระยะห่างระหว่างปุ่มกับวิดเจ็ต หน่วยเป็นพิกเซล ค่าเริ่มต้นคือ `8` |

หลังแก้สำเร็จ ปุ่มจะมี token อยู่ใน `data-cap-token` ด้วย

วิดเจ็ตเริ่มแก้ทันทีที่ปรากฏโดยไม่ต้องคลิก บนคีย์ที่[ให้คะแนนพฤติกรรม](./instrumentation.md#behavior-scoring)และกำหนดให้ต้องมีการโต้ตอบ การแก้ในโหมดลอยจะล้มเหลวด้วย `behavior_no_interaction` เช่นเดียวกับ[โหมดล่องหน](./invisible.md#keys-with-behavior-scoring)
