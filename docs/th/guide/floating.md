---
description: "โหมดลอยของวิดเจ็ต Cap จะซ่อน CAPTCHA โอเพนซอร์สไว้จนกว่าจะมีการกดปุ่ม แล้วค่อยรัน proof-of-work ตามต้องการ ตั้งค่าได้ด้วย data attribute เพียงตัวเดียว"
---

# โหมดลอย

Cap สามารถซ่อน CAPTCHA ไว้โดยอัตโนมัติจนกว่าจะมีการกดปุ่ม วิธีใช้คือเพิ่มแอตทริบิวต์ `data-cap-floating` ให้กับตัวกระตุ้นของคุณ พร้อมระบุ query selector ของอิลิเมนต์ `cap-widget` ที่ต้องการใช้

```html
<cap-widget
  id="floating"
  onsolve="console.log(`token: ${event.detail.token}`)"
  data-cap-api-endpoint="<api endpoint>"
></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">
  เรียกใช้โหมดลอย
</button>
```

คุณต้องนำเข้าทั้งไลบรารี Cap และสคริปต์โหมดลอยจาก JSDelivr ด้วย:

```html{2}
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget/cap-floating.min.js"></script> <!-- [!code ++] -->
```

หรือจากเซิร์ฟเวอร์ standalone:

```html
<script src="https://<server url>/assets/widget.js"></script>
<script src="https://<server url>/assets/floating.js"></script>
<!-- [!code ++] -->
```

แอตทริบิวต์ที่รองรับมีดังนี้:

- `data-cap-floating`: CSS selector ของอิลิเมนต์ `cap-widget` ที่ต้องการใช้
- `data-cap-floating-position`: ตำแหน่งของวิดเจ็ตลอย ใช้ได้เป็น `top` หรือ `bottom`
- `data-cap-floating-offset`: ระยะห่างของวิดเจ็ตลอยจากอิลิเมนต์ที่เป็นตัวกระตุ้น
