---
outline: [2, 3]
description: "วิดเจ็ตฝั่งไคลเอนต์ของ Cap ขอ แก้ และแสดง challenge แบบ proof-of-work ด้วย web component แบบ native และ WASM ติดตั้ง ใช้ในเฟรมเวิร์กใดก็ได้ และปรับแต่งได้"
---

# วิดเจ็ต {#widget}

วิดเจ็ตเป็น web component `<cap-widget>` มันดึง challenge จากเซิร์ฟเวอร์ของคุณ แก้ใน Web Workers ด้วย WebAssembly แล้วส่ง token ให้คุณตรวจสอบ

## การติดตั้ง {#install}

::: code-group

```sh [npm]
npm i cap-widget
```

```sh [pnpm]
pnpm add cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

:::

ระบุเวอร์ชันจาก[หน้ารุ่นที่เผยแพร่](https://github.com/tiagozip/cap/releases)เมื่อใช้ CDN โดย jsDelivr ถูกบล็อกในบางพื้นที่ของจีน หากผู้เข้าชมของคุณอยู่ที่นั่น ให้ติดตั้งจาก npm หรือ[โฮสต์วิดเจ็ตเอง](#self-hosting-the-widget)

## การใช้งาน {#usage}

ตั้ง `data-cap-api-endpoint` ให้ชี้ไปยังเซิร์ฟเวอร์ของคุณ สำหรับ capd คือ `https://<instance>/<site-key>/`

::: code-group

```html [HTML]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>

<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

```jsx [React]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      onsolve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```vue [Vue]
<script setup>
import "cap-widget";
</script>

<template>
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    @solve="(e) => console.log(e.detail.token)"
  />
</template>
```

```svelte [Svelte]
<script>
  import "cap-widget";
</script>

<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  onsolve={(e) => console.log(e.detail.token)}
></cap-widget>
```

```jsx [Solid]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      on:solve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```tsx [Qwik]
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => (
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    on:solve$={(e: CustomEvent) => console.log(e.detail.token)}
  />
));
```

```astro [Astro]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/" />

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

:::

ข้อควรทราบเกี่ยวกับเฟรมเวิร์ก:

- React จัดการเหตุการณ์ของ custom element ได้ถูกต้องตั้งแต่เวอร์ชัน 19 ส่วน Preact ใช้ไวยากรณ์เดียวกัน
- Vue อาจเตือนว่าไม่รู้จักคอมโพเนนต์ ให้บอกคอมไพเลอร์ว่าแท็ก `cap-` เป็น custom element:

  ```js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } })
  ```

- ตัวอย่าง Svelte ใช้ Svelte 5 หากใช้ Svelte 4 ให้ใช้ `on:solve`

### ภายในฟอร์ม {#in-a-form}

ภายใน `<form>` วิดเจ็ตจะเพิ่ม input ซ่อนชื่อ `cap-token` เมื่อแก้สำเร็จ token จึงถูกส่งพร้อมฟิลด์อื่น ๆ เพิ่ม `required` เพื่อป้องกันไม่ให้ส่งฟอร์มก่อนแก้สำเร็จ

```html
<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

หากต้องการแก้โดยไม่แสดงวิดเจ็ต ให้ใช้[โหมดล่องหน](./invisible.md) หากต้องการแสดงเฉพาะเมื่อกดปุ่ม ให้ใช้[โหมดลอย](./floating.md)

## เวลาที่วิดเจ็ตดึงและแก้ challenge {#when-it-fetches-and-solves}

วิดเจ็ตไม่รอให้คลิกก่อนเริ่มทำงาน เมื่อมองเห็นบนหน้าแล้ว มันจะดึง challenge และเริ่มเฟรม [instrumentation](./instrumentation.md) ซึ่งเฝ้าดูหน้าจนแก้เสร็จ มันจะดึงอีกครั้งก่อน challenge หมดอายุระยะหนึ่ง โดยใช้อายุของ challenge จาก token สำหรับ challenge อายุ 10 นาที จะดึงก่อนหมดอายุ 90 วินาทีสำหรับ SHA-256 และ 3 นาทีสำหรับ HashWX

การขยับเมาส์ สัมผัส หรือกดแป้นครั้งแรกบนหน้าจะเริ่มการแก้ล่วงหน้า สำหรับ challenge [รูปแบบ 2](./capjs-core.md#format-2-hashwx) ซึ่ง HashWX ใช้ วิดเจ็ตจะดาวน์โหลดมอดูล HashWX ล่วงหน้าเท่านั้น สำหรับ challenge SHA-256 รูปแบบ 1 มันจะรอ 2.5 วินาทีแล้วแก้ใน worker ตัวเดียว และเมื่อคลิกวิดเจ็ต งานที่เหลือจะย้ายไปใช้ worker ทั้งหมด เมื่อคีย์ไม่ต้องใช้ข้อมูลปฏิสัมพันธ์ วิดเจ็ตจะแลกคำตอบเป็น token ในเบื้องหลังและเก็บ token ไว้ด้วย ทำให้การคลิกวิดเจ็ตคืนค่าได้ทันที เมื่อคีย์ตรวจสอบปฏิสัมพันธ์หรือให้คะแนนพฤติกรรม มันจะรอการคลิกก่อนแลก token เพราะการคลิกเป็นส่วนหนึ่งของข้อมูลที่เซิร์ฟเวอร์ตรวจสอบ หากเซิร์ฟเวอร์ปฏิเสธการแลก token ในเบื้องหลัง การคลิกจะแสดงข้อผิดพลาดนั้น

## เหตุการณ์ {#events}

ทุกเหตุการณ์เป็น `CustomEvent`

| เหตุการณ์ | เกิดขึ้นเมื่อใด | `detail` |
| --- | --- | --- |
| `solve` | แก้ challenge สำเร็จ | `{ token }` |
| `progress` | การแก้มีความคืบหน้า | `{ progress }` ตั้งแต่ 0 ถึง 100 |
| `error` | เกิดข้อผิดพลาด | `{ isCap, code, message }` รหัสอยู่ใน[การแก้ปัญหา](./troubleshooting/instrumentation.md#error-codes) |
| `reset` | วิดเจ็ตกลับสู่สถานะเริ่มต้น | `{}` |

## แอตทริบิวต์ {#attributes}

| แอตทริบิวต์ | หน้าที่ |
| --- | --- |
| `data-cap-api-endpoint` | endpoint ของเซิร์ฟเวอร์คุณ จำเป็นต้องระบุ |
| `data-cap-worker-count` | จำนวน worker ที่ใช้แก้ challenge ค่าเริ่มต้นเท่ากับจำนวนคอร์ CPU หรือ 8 |
| `data-cap-hidden-field-name` | ชื่อของ input ซ่อนในฟอร์ม ค่าเริ่มต้นคือ `cap-token` |
| `data-cap-lang` | บังคับใช้[ภาษา](#languages)ที่กำหนด |
| `data-cap-troubleshooting-url` | ปลายทางของลิงก์แก้ปัญหาเมื่อผู้เข้าชมถูกบล็อก |
| `data-cap-disable-haptics` | ปิดการสั่นบนโทรศัพท์ |
| `required` | ป้องกันการส่งฟอร์มจนกว่าวิดเจ็ตจะแก้สำเร็จ |

## ภาษา {#languages}

วิดเจ็ตใช้ภาษาตามเบราว์เซอร์สำหรับภาษาอาหรับ จีนตัวย่อ ฝรั่งเศส เยอรมัน ฮินดี ญี่ปุ่น โปรตุเกส รัสเซีย และสเปน และใช้ภาษาอังกฤษในกรณีอื่น ตั้ง `data-cap-lang="de"` บนวิดเจ็ต หรือ `window.CAP_LANG = "de"` สำหรับทั้งหน้า เพื่อเลือกภาษาเอง

หากต้องการเปลี่ยนข้อความใด ให้ตั้งแอตทริบิวต์ `data-cap-i18n-*` ของข้อความนั้น:

```html
<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  data-cap-i18n-initial-state="I'm not a robot"
  data-cap-i18n-solved-label="Done"
></cap-widget>
```

คีย์ที่ใช้ได้คือ `initial-state`, `verifying-label`, `solved-label`, `error-label`, `csp-error-label`, `required-label`, `troubleshooting-label`, `wasm-disabled` และข้อความสำหรับโปรแกรมอ่านหน้าจอ `group-aria-label`, `verify-aria-label`, `verifying-aria-label`, `verified-aria-label` และ `error-aria-label`

## การปรับแต่งสไตล์ {#styling}

แทนที่ตัวแปร CSS เหล่านี้บน `cap-widget` ค่าที่แสดงคือค่าเริ่มต้น

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

## ตัวเลือกสำหรับทั้งหน้า {#options}

ตั้งค่าเหล่านี้บน `window` ก่อนวิดเจ็ตโหลด

| ตัวเลือก | หน้าที่ |
| --- | --- |
| `CAP_CUSTOM_FETCH` | แทนที่ `fetch` สำหรับคำขอของวิดเจ็ต |
| `CAP_CSS_NONCE` | nonce สำหรับแท็ก `<style>` ที่แทรกเข้าไป ภายใต้ Content Security Policy ที่เข้มงวด ใช้กับสคริปต์ด้วยหากไม่ได้ตั้ง `CAP_SCRIPT_NONCE` |
| `CAP_SCRIPT_NONCE` | nonce สำหรับสคริปต์ที่แทรกเข้าไป ได้แก่ ตัวสำรองสำหรับคลายบีบอัดและ iframe ของ instrumentation |
| `CAP_ISOLATE` | รันเฟรม instrumentation โดยไม่ใช้ origin ของหน้าคุณ ดู[หน้าที่มีบั๊กการแทรก HTML](#pages-with-an-html-injection-bug) |
| `CAP_PAKO_URL` | URL ของ `pako_inflate.min.js` ซึ่งวิดเจ็ตโหลดเฉพาะในเบราว์เซอร์ที่ไม่มี `DecompressionStream` |
| `CAP_CUSTOM_WASM_URL` | URL ของ `cap_wasm_bg.wasm` |
| `CAP_CUSTOM_HASHWX_URL` | URL ของ `hashwx.wasm` |
| `CAP_LANG` | บังคับใช้[ภาษา](#languages)ที่กำหนดในทุกวิดเจ็ต |
| `CAP_DISABLE_HAPTICS` | ปิดการสั่นสำหรับทุกวิดเจ็ต |
| `CAP_DISABLE_WIDGET_REF` | ไม่ใส่ที่อยู่หน้าของคุณในลิงก์เครดิต Cap ของวิดเจ็ต |
| `CAP_DEBUG` | บันทึกทุกขั้นตอนของการดึงและแก้ challenge ลงคอนโซล |
| `CAP_SILENT` | ปิดเอาต์พุตทั้งหมดของวิดเจ็ตในคอนโซล |

## Content Security Policy

วิดเจ็ตทำงานภายใต้ Content Security Policy ที่เข้มงวดได้ โดยต้องอนุญาตแหล่งต่อไปนี้:

| คำสั่ง | แหล่ง | เหตุผล |
| --- | --- | --- |
| `script-src` | `'nonce-...'` หรือโฮสต์ของวิดเจ็ต | โหลดสคริปต์วิดเจ็ต |
| `script-src` | `'wasm-unsafe-eval'` | คอมไพล์ตัวแก้ WebAssembly |
| `worker-src` | `blob:` | รันตัวแก้ใน Web Workers ที่สร้างจาก blob URL |
| `connect-src` | เซิร์ฟเวอร์ Cap ของคุณ และ `cdn.jsdelivr.net` เว้นแต่คุณจะ[โฮสต์เอง](#self-hosting-the-widget) | ดึง challenge แลก token และดาวน์โหลดไฟล์ WASM |
| `style-src` | `'nonce-...'` | อนุญาตแท็ก `<style>` ที่วิดเจ็ตแทรกเข้าไป ตั้ง `CAP_CSS_NONCE` |

สคริปต์ [instrumentation](./instrumentation.md) รันใน iframe แบบ `srcdoc` ซึ่งรับนโยบายจากหน้า วิดเจ็ตจะเพิ่ม nonce ให้สคริปต์นั้นและสคริปต์สำรอง pako ในเบราว์เซอร์เก่า เฉพาะเมื่อคุณตั้ง `window.CAP_SCRIPT_NONCE` เป็น nonce จาก `script-src` ก่อนวิดเจ็ตโหลด หากไม่ได้ตั้ง เบราว์เซอร์จะบล็อกสคริปต์และการแก้จะล้มเหลวหลังเฟรมโหลด 250 มิลลิวินาที วิดเจ็ตแสดง "ถูกบล็อกโดยหน้านี้" ส่งเหตุการณ์ `error` พร้อมรหัส `instr_csp_blocked` และบันทึกข้อผิดพลาดในคอนโซลที่ชี้มาที่นี่ เซิร์ฟเวอร์บันทึกความล้มเหลวด้วยรหัสเดียวกัน หากคุณโหลด pako จากที่อื่นนอกจาก jsDelivr ให้ตั้ง `CAP_PAKO_URL` และอนุญาตโฮสต์นั้นใน `script-src`

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_CSS_NONCE = "r4nd0m";
</script>
<script nonce="r4nd0m" src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

```
Content-Security-Policy: script-src 'nonce-r4nd0m' 'wasm-unsafe-eval'; worker-src blob:; style-src 'nonce-r4nd0m'; connect-src 'self' https://cdn.jsdelivr.net
```

สร้าง nonce ใหม่สำหรับทุกการตอบกลับ หากเสิร์ฟวิดเจ็ตจาก `/assets` ของ capd ให้อนุญาตเซิร์ฟเวอร์ Cap ของคุณใน `script-src` และ `connect-src` แล้วนำ jsDelivr ออก

คุณไม่จำเป็นต้องใช้ `'unsafe-eval'` การตรวจสอบ instrumentation บางอย่างใช้ `eval` และ `new Function` เมื่อทั้งคู่โยน `EvalError` สคริปต์จะข้ามการตรวจสอบเหล่านั้น รันส่วนที่เหลือ และเซิร์ฟเวอร์จะเพิ่ม `csp_eval_blocked` ใน `riskFlags` หากมีเพียงตัวเดียวที่โยนข้อผิดพลาด สคริปต์จะถือว่าเป็นการดัดแปลงและล้มเหลวด้วย `instr_natives_tampered` สคริปต์ยังบันทึกด้วยว่าเบราว์เซอร์ส่งเหตุการณ์ `securitypolicyviolation` สำหรับ `eval` ที่ถูกบล็อกหรือไม่ และละเว้นเหตุการณ์ที่มี `isTrusted` เป็น `false` สคริปต์ในหน้าจึงปลอมการยืนยันนี้ไม่ได้ แฟล็กนี้ให้ข้อมูลเท่านั้นและไม่เคยถือเป็นคะแนนบวกให้ผู้เข้าชม

วิดเจ็ตที่เก่ากว่ารุ่นนี้ยังทำงานกับเซิร์ฟเวอร์ใหม่ได้ โดยมีข้อจำกัดตามที่อธิบายใน[วิดเจ็ตจากรุ่นก่อน](./instrumentation.md#widgets-from-earlier-releases)

### หน้าที่มีบั๊กการแทรก HTML {#pages-with-an-html-injection-bug}

เฟรม instrumentation ใช้ origin เดียวกับหน้าของคุณ และเมื่อตั้ง `CAP_SCRIPT_NONCE` วิดเจ็ตจะให้ nonce ของคุณกับสคริปต์ในเฟรม วิดเจ็ตรันสคริปต์ใดก็ตามที่เซิร์ฟเวอร์ใน `data-cap-api-endpoint` ส่งมา หากผู้โจมตีแทรก HTML ในหน้าที่ตั้ง `CAP_SCRIPT_NONCE` ได้ พวกเขาสามารถเพิ่ม `<cap-widget>` ที่ชี้ไปยังเซิร์ฟเวอร์ของตน แล้วสคริปต์จากเซิร์ฟเวอร์นั้นจะรันด้วย origin ของหน้าคุณและผ่านนโยบายของคุณ บนหน้านั้น บั๊กที่นโยบายควรจำกัดความเสียหายได้จะกลายเป็น cross-site scripting

เรื่องนี้มีผลเฉพาะหน้าที่พึ่งนโยบายแบบ nonce เพื่อจำกัดความเสียหายจากการแทรก HTML หากไม่มีนโยบายเช่นนั้น HTML ที่แทรกเข้ามารันสคริปต์ได้อยู่แล้ว และวิดเจ็ตไม่ได้เพิ่มความเสี่ยง

สำหรับหน้าเหล่านั้น ให้ตั้ง `window.CAP_ISOLATE = true` ในสคริปต์ก่อนวิดเจ็ตโหลด:

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_ISOLATE = true;
</script>
```

วิดเจ็ตจะรันเฟรมโดยไม่มี `allow-same-origin` สคริปต์ในเฟรมจึงได้รับ opaque origin และอ่านหรือเปลี่ยนแปลงหน้าของคุณ คุกกี้ หรือ storage ไม่ได้ ไม่ว่าเซิร์ฟเวอร์ใดจะส่งสคริปต์มา ต้องตั้งค่านี้ผ่าน JavaScript เพราะ HTML ที่แทรกเข้ามารัน JavaScript ไม่ได้ และหากใช้แอตทริบิวต์บนวิดเจ็ต ผู้โจมตีก็จะควบคุมค่านั้นได้

การตรวจสอบจะไม่ได้ข้อมูลที่อ่านจากหน้าอีกต่อไป โดยยังรัน[การตรวจสอบเบราว์เซอร์อัตโนมัติ](./instrumentation.md#automated-browser-detection)ภายในเฟรมของตัวเอง แต่บันทึกการโต้ตอบ ข้อมูลพฤติกรรม หรือร่องรอยของ AI agent ไม่ได้ สำหรับคีย์ที่รายงานสัญญาณเหล่านี้อย่างเดียว เซิร์ฟเวอร์จะยอมรับการแก้ challenge พร้อมแฟล็กความเสี่ยง `isolated_frame` แต่จะปฏิเสธด้วย `instr_isolated` สำหรับคีย์ที่บล็อกการโต้ตอบอัตโนมัติ ให้คะแนนพฤติกรรมโดยเปิดการบล็อกไว้ หรือบล็อก agent

## การโฮสต์วิดเจ็ตเอง {#self-hosting-the-widget}

วิดเจ็ตโหลดจาก jsDelivr โดยค่าเริ่มต้น เช่นเดียวกับไฟล์ WASM สองไฟล์ที่ตัวแก้ดึงมา หากต้องการเสิร์ฟทั้งหมดจากโดเมนของคุณเอง:

1. เสิร์ฟสคริปต์เอง โดยนำเข้า `cap-widget` ผ่าน bundler หรือใช้[เซิร์ฟเวอร์แอสเซ็ต](./capd/options.md#asset-server)ของ capd ที่ `/assets/widget.js`
2. ตั้งให้ตัวแก้ชี้ไปยังสำเนาไฟล์ WASM ของคุณก่อนวิดเจ็ตเริ่มแก้อะไร:

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

เมื่อใช้ bundler ให้ตั้งตัวแปรส่วนกลางทั้งสองก่อน `import "cap-widget"` ทำงาน URL ชี้ไปยังที่ใดก็ได้ที่คุณโฮสต์ไฟล์ไว้
