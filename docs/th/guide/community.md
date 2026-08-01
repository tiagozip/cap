---
description: "ไลบรารีที่ชุมชนดูแล สำหรับใช้ Cap ซึ่งเป็น CAPTCHA โอเพนซอร์สที่โฮสต์เองได้ กับภาษาและเฟรมเวิร์กอื่น ๆ ตรวจสอบ token แบบ proof-of-work ได้นอกเหนือจาก SDK"
---

# ไลบรารีจากชุมชน

อยากใช้ Cap โดยไม่ใช้เซิร์ฟเวอร์ standalone และใช้ภาษาอื่นใช่ไหม? นี่คือไลบรารีที่ชุมชนดูแลซึ่งอาจช่วยคุณได้ ถ้าอยากเพิ่มไลบรารี เชิญเปิด pull request ได้เลย!

**หมายเหตุ:** ไลบรารีเหล่านี้มักจะ**ไม่**รองรับฟีเจอร์ใหม่ ๆ อย่าง challenge แบบมี seed หรือ challenge แบบ instrumentation

## วิดเจ็ต

สิ่งเหล่านี้คือ wrapper ครอบวิดเจ็ตของ Cap โดยทั่วไปไม่จำเป็นต้องใช้ เพราะวิดเจ็ตมาตรฐานควรทำงานได้ทุกที่อยู่แล้ว แต่มันอาจทำให้ประสบการณ์การพัฒนาดีขึ้น

### React

- **[@pitininja/cap-react-widget](https://www.npmjs.com/package/@pitininja/cap-react-widget)**
- **[cap-widget](https://ui.ednesdayw.com/docs/components/cap-widget)**: คอมโพเนนต์ React แบบ headless ที่เข้ากันได้กับ shadcn สำหรับ CAP

### Angular

- **[@espressotutorialsgmbh/cap-angular-widget](https://www.npmjs.com/package/@espressotutorialsgmbh/cap-angular-widget)**

### Vue

- **[nuxt-cap](https://github.com/dethdkn/nuxt-cap)**

### อื่น ๆ

- **[better-captcha](https://www.better-captcha.dev/docs/provider/cap-widget)**: วิดเจ็ตที่ไม่ผูกกับเฟรมเวิร์กใด รองรับถึง 6 เฟรมเวิร์ก ทั้ง React, SolidJS, Vue, Svelte และอื่น ๆ

## Hooks

สิ่งเหล่านี้คือการนำ API ของ Cap มาทำเป็น React hook ทำให้ปรับแต่งประสบการณ์ผู้ใช้ได้เต็มที่

- **[@takeshape/use-cap](https://www.npmjs.com/package/@takeshape/use-cap)**

## เซิร์ฟเวอร์

**คำเตือน:** ไลบรารีเหล่านี้ดูแลโดยชุมชน ไม่ได้รับการสนับสนุนอย่างเป็นทางการและ Cap ไม่ได้ตรวจสอบด้านความปลอดภัยอย่างต่อเนื่อง เราจึงรับประกันคุณภาพ ความปลอดภัย หรือความเข้ากันได้ไม่ได้ และอาจไม่รองรับฟีเจอร์ใหม่อย่าง storage hook หรือ challenge แบบมี seed

### Cloudflare Workers (Serverless/JavaScript)

- **[kaerez/CFCap](https://github.com/kaerez/CFCap)**: การนำ CAP CAPTCHA มาใช้แบบ serverless บน Cloudflare Workers ร่วมกับ R2 Bucket (ถูกกว่า Durable Objects) ปรับ TTL ได้ เลือกใช้ JS และ WASM แบบโฮสต์ได้ พร้อมการดีพลอยที่ edge ทั่วโลกและสเกลอัตโนมัติ

### Cloudflare Workers (Serverless/JavaScript/TypeScript)

- **[xyTom/cap-worker](https://github.com/xyTom/cap-worker)**: การนำ CAP CAPTCHA มาใช้แบบ serverless บน Cloudflare Workers ร่วมกับ Durable Objects พร้อมการดีพลอยที่ edge ทั่วโลกและสเกลอัตโนมัติ

### Java

- **[luckygc/cap-server](https://github.com/luckygc/cap-server)**: ตัวแทนเซิร์ฟเวอร์ Java ของ wuhunyu ที่แก้[ปัญหาสำคัญ](https://github.com/tiagozip/cap/issues/69#issuecomment-3079407189)

- **[wuhunyu/cap-server-java](https://github.com/wuhunyu/cap-server-java)**

- **[schwebke/cap-captcha-keycloak](https://github.com/schwebke/cap-captcha-keycloak)**: ส่วนขยายของ Keycloak ที่เพิ่มการตรวจสอบ captcha ของ Cap ให้ขั้นตอนการสมัครสมาชิก

### Go

- **[samwafgo/cap_go_server](https://github.com/samwafgo/cap_go_server)**
- **[ackcoder/go-cap](https://github.com/ackcoder/go-cap)**

### Python

- **[capjs-server](https://github.com/vshn/capjs-server)**: ไลบรารีเซิร์ฟเวอร์ Python แบบไร้สถานะสำหรับตรวจสอบ token ของ Cap (ไม่ต้องใช้ฐานข้อมูล)
- **[django-cap](https://pypi.org/project/django-cap/)**: การนำเซิร์ฟเวอร์ของ Cap มาใช้กับ Django ด้วย Python

### .NET

- **[izanhzh/pow-cap-server](https://github.com/izanhzh/pow-cap-server)**

### PHP

- **[clysss/capito](https://github.com/clysss/capito)**: เซิร์ฟเวอร์ PHP ชื่อ Capito สำหรับ Cap
- **[trilbymedia/cap-php](https://github.com/trilbymedia/cap-php)**: เวอร์ชัน PHP ของเซิร์ฟเวอร์ captcha แบบ proof-of-work ของ Cap
- **[oliweb-proof-of-work-for-cap](https://github.com/oli217/oliweb-proof-of-work-for-cap)**: ปลั๊กอิน WordPress ที่ผนวก Cap เข้ากับความคิดเห็น การเข้าสู่ระบบ การสมัครสมาชิก และหน้าชำระเงินของ WooCommerce รองรับทั้งวิดเจ็ตแบบมองเห็นและโหมดล่องหน (programmatic)
- **[laravel-cap](https://github.com/oli217/laravel-cap)**: การผนวก Cap เข้ากับ Laravel พร้อม Blade directive, มิดเดิลแวร์, กฎการตรวจสอบ และ facade สำหรับตรวจสอบ token ฝั่งเซิร์ฟเวอร์ (`composer require oliweb/laravel-cap`)
- **[statamic-cap](https://github.com/oli217/statamic-cap)**: ส่วนเสริมของ Statamic ที่ผนวก Cap เข้ากับฟอร์ม ทั้งการเรนเดอร์วิดเจ็ต การตรวจสอบ token อัตโนมัติ และการตั้งค่าที่ยืดหยุ่นใน control panel (`composer require oliweb/statamic-cap`)
- **[cap-captcha-wordpress](https://github.com/forge28labs/cap-captcha-wordpress)**: ปลั๊กอิน WordPress ที่ผนวก Cap เข้ากับขั้นตอนยืนยันตัวตนและการแสดงความคิดเห็นใหม่ ตั้งค่าอินสแตนซ์ คีย์ และสีได้จากหน้าผู้ดูแลระบบของ WordPress

## ไคลเอนต์

**คำเตือน:** ไลบรารีเหล่านี้ดูแลโดยชุมชน ไม่ได้รับการสนับสนุนอย่างเป็นทางการและ Cap ไม่ได้ตรวจสอบด้านความปลอดภัยอย่างต่อเนื่อง เราจึงรับประกันคุณภาพ ความปลอดภัย หรือความเข้ากันได้ไม่ได้

### JavaScript

- **[cap-client](https://codeberg.org/sanin/cap-client)**: ไลบรารีฝั่งไคลเอนต์และมิดเดิลแวร์ Express สำหรับส่งคำขอตรวจสอบ ออกแบบมาสำหรับ NodeJS
