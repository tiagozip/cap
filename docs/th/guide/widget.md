---
outline: [2, 3, 4]
description: "วิดเจ็ตฝั่งไคลเอนต์ของ Cap ทำหน้าที่ขอ แก้ และแสดง challenge แบบ proof-of-work ด้วย web component มาตรฐานและ WASM เอกสารฝั่งไคลเอนต์ของ CAPTCHA โอเพนซอร์สตัวนี้"
---

# วิดเจ็ต

วิดเจ็ตฝั่งไคลเอนต์ของ Cap ดูแลการขอ แก้ และแสดง challenge โดยใช้ web component มาตรฐานและ WASM ที่เขียนด้วย Rust อีกทั้งยังมี[โหมด programmatic](./programmatic) มาให้ด้วย

## การติดตั้ง

::: code-group

```sh [pnpm]
pnpm add cap-widget
```

```sh [npm]
npm i cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<!--

* บนโปรดักชันคุณควรตรึงเวอร์ชันที่แน่นอนไว้ เพื่อเลี่ยงการเปลี่ยนแปลงที่ทำให้ระบบพัง หรือจะใช้ asset server ของ standalone ก็ได้
* `cdn.jsdelivr.net` ถูกบล็อกในบางเขตอำนาจศาล เช่นบางพื้นที่ของจีน ถ้าเว็บของคุณต้องเข้าถึงได้จากที่นั่น เราแนะนำให้ใช้ npm

-->

<script type="module" src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
```

:::

## วิธีใช้งาน {#usage}

วิดเจ็ตต้องมี `data-cap-api-endpoint` ที่ชี้ไปยัง Cap ที่คุณดีพลอยไว้ สำหรับอินสแตนซ์ Standalone จะเป็น:

```
https://<your-instance>/<site-key>/
```

### Vanilla

```html
<form>
  <cap-widget id="cap" required data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">ส่ง</button>
</form>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

::: tip

เมื่อวิดเจ็ตอยู่ภายใน `<form>` มันจะแทรก input ซ่อนชื่อ `cap-token` ให้อัตโนมัติ และ token จะถูกส่งไปพร้อมฟิลด์อื่น ๆ ของคุณโดยไม่ต้องเขียน JavaScript เพิ่ม

:::

### React

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">ส่ง</button>
    </form>
  );
}
```

::: tip

เราแนะนำให้ใช้ React 19 ขึ้นไป เพราะปรับปรุงการจัดการเหตุการณ์ของ custom element ให้ดีขึ้น

:::

### Vue

```vue
<script setup>
import "cap-widget";
</script>

<template>
  <form>
    <cap-widget
      data-cap-api-endpoint="https://<your-instance>/<site-key>/"
      @solve="(e) => console.log('token:', e.detail.token)"
      @progress="(e) => console.log(e.detail.progress)"
      @error="(e) => console.error(e.detail.message)"
    />
    <button type="submit">ส่ง</button>
  </form>
</template>
```

ถ้าเจอคำเตือนว่าไม่รู้จักคอมโพเนนต์ ให้เพิ่มสิ่งนี้ใน `vite.config.js` ของคุณ:

```js
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") },
      },
    }),
  ],
});
```

### Svelte 5

```svelte
<script>
  import "cap-widget";
</script>

<form>
  <cap-widget
    data-cap-api-endpoint="https://<your-instance>/<site-key>/"
    on:solve={(e) => console.log("token:", e.detail.token)}
    on:progress={(e) => console.log(e.detail.progress)}
    on:error={(e) => console.error(e.detail.message)}
  />
  <button type="submit">ส่ง</button>
</form>
```

### SolidJS

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve={(e) => console.log("token:", e.detail.token)}
        on:progress={(e) => console.log(e.detail.progress)}
        on:error={(e) => console.error(e.detail.message)}
      />
      <button type="submit">ส่ง</button>
    </form>
  );
}
```

### Astro

```astro
---
// ContactForm.astro
---

<form>
  <cap-widget id="cap" data-cap-api-endpoint="https://<your-instance>/<site-key>/" />
  <button type="submit">ส่ง</button>
</form>

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

ถ้าคุณเรนเดอร์คอมโพเนนต์ React/Vue/Svelte ภายใน Astro ให้ทำตามคู่มือของเฟรมเวิร์กนั้นด้านบน แล้วเพิ่ม `client:load` ให้คอมโพเนนต์

### Preact

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">ส่ง</button>
    </form>
  );
}
```

### Qwik

```tsx
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve$={(e: CustomEvent) => console.log("token:", e.detail.token)}
        on:progress$={(e: CustomEvent) => console.log(e.detail.progress)}
        on:error$={(e: CustomEvent) => console.error(e.detail.message)}
      />
      <button type="submit">ส่ง</button>
    </form>
  );
});
```

## โหมด programmatic

ถ้าคุณไม่ต้องการวิดเจ็ตที่มองเห็นได้ เช่นตอนป้องกันการทำงานเบื้องหลังอย่างการส่งโพสต์ ให้ใช้[โหมด programmatic](./programmatic):

```js
import Cap from "cap-widget";

const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
});

const { token } = await cap.solve();
```

## เหตุการณ์ที่รองรับ {#supported-events}

ทุกเหตุการณ์ถูกส่งออกมาในรูป CustomEvent

| เหตุการณ์  | เกิดขึ้นเมื่อใด                | รายละเอียด             |
| ---------- | ------------------------------ | ---------------------- |
| `solve`    | แก้ challenge สำเร็จ           | `{ token: string }`    |
| `progress` | รายงานความคืบหน้าระหว่างแก้    | `{ progress: number }` |
| `error`    | เกิดข้อผิดพลาด                 | `{ message: string }`  |
| `reset`    | วิดเจ็ตกลับสู่สถานะเริ่มต้น     | `{}`                   |

## ตัวเลือกการตั้งค่า {#options}

คุณกำหนดฟังก์ชัน fetch ของคุณเองได้ด้วย `window.CAP_CUSTOM_FETCH`:

```js
window.CAP_CUSTOM_FETCH = (url, params) => fetch(url, params);
```

ถ้าคุณเสิร์ฟวิดเจ็ตภายใต้ Content-Security-Policy ที่เข้มงวด คุณกำหนด nonce ได้ เพื่อไม่ให้อิลิเมนต์ `<style>` และ `<script>` ที่วิดเจ็ตแทรกเข้าไปถูกบล็อก:

- `window.CAP_CSS_NONCE` — ใช้กับแท็ก `<style>` ของวิดเจ็ต และใช้เป็น nonce สำรองสำหรับสคริปต์ที่แทรกเข้าไปด้วย หากไม่ได้ตั้ง `CAP_SCRIPT_NONCE`
- `window.CAP_SCRIPT_NONCE` — ใช้กับสคริปต์ที่วิดเจ็ตแทรกเข้าไป ได้แก่ ตัวสำรองสำหรับคลายบีบอัดด้วย pako และ iframe ของ challenge แบบ instrumentation

คุณยังตั้ง URL ของ WASM เองได้ (เช่นของ asset server ในโหมด Standalone) ด้วย `window.CAP_CUSTOM_WASM_URL`

หากต้องการปิดการสั่นตอบสนอง (การสั่นบนอุปกรณ์มือถือ) ให้ตั้ง `window.CAP_DISABLE_HAPTICS = true` แบบทั่วทั้งหน้า หรือเพิ่มแอตทริบิวต์ `data-cap-disable-haptics` ให้วิดเจ็ตแต่ละตัว:

```js
window.CAP_DISABLE_HAPTICS = true;
```

```html
<cap-widget data-cap-disable-haptics data-cap-api-endpoint="..."></cap-widget>
```

การสั่นตอบสนองจะถูกปิดอัตโนมัติใน[โหมด programmatic](./programmatic) เพราะไม่มีวิดเจ็ตให้ผู้ใช้โต้ตอบด้วย

### แอตทริบิวต์

| แอตทริบิวต์                     | คำอธิบาย                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `data-cap-api-endpoint`        | **จำเป็น** endpoint ของ Cap คุณ: `https://<instance>/<site-key>/`             |
| `data-cap-worker-count`        | จำนวน worker ที่ใช้แก้ challenge (ค่าเริ่มต้น `navigator.hardwareConcurrency \|\| 8`) |
| `data-cap-hidden-field-name`   | ชื่อของ input ซ่อนที่เก็บ token ใน `<form>` (ค่าเริ่มต้น: `cap-token`)         |
| `data-cap-troubleshooting-url` | URL ที่กำหนดเองสำหรับลิงก์ "แก้ปัญหา" ที่แสดงเมื่อผู้ใช้ถูกบล็อก              |
| `data-cap-disable-haptics`     | ปิดการสั่นตอบสนองสำหรับวิดเจ็ตตัวนี้                                          |

#### i18n

ข้อความทั้งหมดในวิดเจ็ตแทนที่ได้ด้วยแอตทริบิวต์ `data-cap-i18n-*` โดยค่าเริ่มต้นเป็นภาษาอังกฤษ

```html
<cap-widget
  data-cap-api-endpoint="https://<your-instance>/<site-key>/"
  data-cap-i18n-initial-state="ยืนยันว่าคุณเป็นมนุษย์"
  data-cap-i18n-verifying-label="กำลังตรวจสอบ..."
  data-cap-i18n-solved-label="คุณเป็นมนุษย์"
  data-cap-i18n-error-label="เกิดข้อผิดพลาด"
  data-cap-i18n-troubleshooting-label="แก้ปัญหา"
  data-cap-i18n-wasm-disabled="เปิดใช้ WASM เพื่อให้แก้ได้เร็วขึ้นมาก"
  data-cap-i18n-verify-aria-label="คลิกเพื่อยืนยันว่าคุณเป็นมนุษย์"
  data-cap-i18n-verifying-aria-label="กำลังตรวจสอบ กรุณารอสักครู่"
  data-cap-i18n-verified-aria-label="ยืนยันแล้ว"
  data-cap-i18n-required-label="กรุณายืนยันว่าคุณเป็นมนุษย์"
  data-cap-i18n-error-aria-label="เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
></cap-widget>
```

### การปรับแต่งสไตล์

แทนที่ตัวแปร CSS เหล่านี้ตัวใดก็ได้บนอิลิเมนต์ `cap-widget`:

```css
cap-widget {
  --cap-background: #fdfdfd;
  --cap-border-color: #dddddd8f;
  --cap-border-radius: 14px;
  --cap-widget-height: 30px;
  --cap-widget-width: 230px;
  --cap-widget-padding: 14px;
  --cap-gap: 15px;
  --cap-color: #212121;
  --cap-checkbox-size: 25px;
  --cap-checkbox-border: 1px solid #aaaaaad1;
  --cap-checkbox-border-radius: 6px;
  --cap-checkbox-background: #fafafa91;
  --cap-checkbox-margin: 2px;
  --cap-font: system-ui, -apple-system, sans-serif;
  --cap-spinner-color: #000;
  --cap-spinner-background-color: #eee;
  --cap-spinner-thickness: 5px;
}
```
