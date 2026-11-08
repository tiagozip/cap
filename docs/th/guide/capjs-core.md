---
outline: [2, 3]
description: "capjs-core คือไลบรารีฝั่งเซิร์ฟเวอร์แบบไร้สถานะของ Cap สำหรับสร้างและตรวจสอบ challenge แบบ proof-of-work ด้วย JWT ที่ลงลายเซ็น รัน CAPTCHA โอเพนซอร์สบน Workers, Lambda หรือแบ็กเอนด์ของคุณเอง"
---

# ไลบรารีหลัก {#core-library}

`capjs-core` สร้างและตรวจสอบ challenge ภายในเซิร์ฟเวอร์ของคุณเอง มันไร้สถานะ โดย challenge เป็น JWT ที่ลงลายเซ็น จึงไม่ต้องใช้ฐานข้อมูล ระบบไฟล์ หรือสถานะในหน่วยความจำ และรันบน Cloudflare Workers, Lambda และ edge runtime อื่น ๆ ได้ capd สร้างขึ้นบนไลบรารีนี้

ผู้ใช้ส่วนใหญ่ควรรัน [capd](./capd/index.md) ซึ่งเป็นเซิร์ฟเวอร์ของ Cap แทน โดย capd เพิ่มแดชบอร์ด สถิติ การจำกัดอัตราคำขอ และที่เก็บ token ใช้ไลบรารีนี้เมื่อคุณรันคอนเทนเนอร์ไม่ได้ หรือต้องการสร้าง challenge ภายในบริการที่มีอยู่

::: code-group

```sh [npm]
npm i capjs-core
```

```sh [pnpm]
pnpm add capjs-core
```

```sh [bun]
bun add capjs-core
```

:::

## เริ่มต้นใช้งาน {#getting-started}

คุณต้องมีสองเส้นทาง เส้นทางหนึ่งสร้าง challenge และอีกเส้นทางตรวจสอบคำตอบ ตั้ง `data-cap-api-endpoint` ของวิดเจ็ตให้ชี้ไปยัง prefix ร่วมของทั้งสองเส้นทาง แล้ววิดเจ็ตจะเรียก `<prefix>challenge` และ `<prefix>redeem`

```js
import { generateChallenge, validateChallenge } from "capjs-core";

const SECRET = process.env.CAP_SECRET;

app.post("/cap/challenge", async () => {
  return await generateChallenge(SECRET, { instrumentation: true });
});

app.post("/cap/redeem", async (req) => {
  return await validateChallenge(SECRET, req.body, { consumeNonce });
});
```

`SECRET` ใช้ลงลายเซ็นทุก challenge ตั้งให้ยาวและสุ่ม อย่างน้อย 16 ไบต์ และใช้ค่าเดียวกันทุกโพรเซส

`consumeNonce` ป้องกันไม่ให้นำ challenge ที่แก้แล้วมาแลก token สองครั้ง โดยคุณต้องจัดเตรียมมันจากที่เก็บข้อมูลของคุณเอง ดู[การป้องกัน replay](#replay-prevention)

## การตรวจสอบ token {#verifying-tokens}

เมื่อ `validateChallenge` สำเร็จ มันจะคืน `token` สำหรับผู้เข้าชมและ `tokenKey` สำหรับคุณ ไลบรารีไม่เก็บทั้งสองค่าไว้ จึงต้องบันทึก `tokenKey` พร้อม `expires`:

```js
const result = await validateChallenge(SECRET, req.body, { consumeNonce });
if (result.success) {
  await store.set(`cap-token:${result.tokenKey}`, result.expires);
}
return result;
```

วิดเจ็ตส่ง `token` ให้ฟอร์มของคุณ เมื่อได้รับฟอร์ม ให้คำนวณคีย์จาก token ที่ส่งมาแล้วค้นหา:

```js
import { createHash } from "node:crypto";

const [id, secret] = req.body["cap-token"].split(":");
const tokenKey = `${id}:${createHash("sha256").update(secret).digest("hex")}`;
const expires = await store.get(`cap-token:${tokenKey}`);

if (!expires || Number(expires) < Date.now()) {
  return new Response("invalid captcha", { status: 403 });
}
await store.delete(`cap-token:${tokenKey}`);
```

การลบคีย์ทำให้แต่ละ token ใช้ได้เพียงครั้งเดียว

## HashWX {#format-2-hashwx}

โดยค่าเริ่มต้น `generateChallenge` จะออก proof-of-work แบบ [HashWX](./hashwx.md) ซึ่งเป็นรูปแบบเดียวกับที่ capd ใช้สำหรับคีย์ใหม่ และต้านทาน GPU ได้ดีกว่า SHA-256 มาก `instrumentation: true` และ `behavior` จะเพิ่ม instrumentation challenge เข้าไปด้วย

หากต้องการระบุโปรโตคอลเอง ให้ส่งพร้อม `format: 2`:

```js
return await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
});
```

`format: 1` จะกลับไปใช้ proof-of-work แบบ SHA-256 เช่นเดียวกับการส่ง `challengeCount`, `challengeSize` หรือ `challengeDifficulty` โดยไม่ระบุ `format` วิดเจ็ตตรวจจับรูปแบบเอง และ `validateChallenge` รองรับทั้งสองรูปแบบ HashWX ต้องใช้วิดเจ็ตเวอร์ชัน 0.1.58 ขึ้นไป ดังนั้นให้อัปเดตวิดเจ็ตที่ปักเวอร์ชันไว้ก่อนอัปเดตไลบรารี

| ตัวเลือก | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| `hashwxDifficulty` | `1_000_000` | จำนวนแฮชที่คาดหวังต่อการแก้หนึ่งครั้ง รวมทุก challenge ย่อย |
| `hashwxChallengeCount` | `4` | จำนวน challenge ย่อยที่แบ่งความยากออกไป ยิ่งมีมาก เวลาแก้ยิ่งแปรปรวนน้อยลง ดู[ต้นทุนฝั่งไคลเอนต์](./hashwx.md#cost) |
| `hashwxNoncesPerHash` | `65_536` | จำนวน nonce ที่ฟังก์ชันแฮชแต่ละตัวที่สร้างขึ้นครอบคลุม |

HashWX ไม่ต้องใช้คีย์หรือตั้งค่า การตรวจสอบครั้งแรกจะคอมไพล์มอดูล WebAssembly ขนาดเล็ก และคุณเรียก `await hashwxReady()` ตอนเริ่มระบบเพื่อทำขั้นตอนนี้ล่วงหน้าได้

บาง runtime ไม่อนุญาตให้คอมไพล์ WebAssembly ระหว่างรัน Cloudflare Workers จะได้รับมอดูลที่คอมไพล์ไว้แล้วโดยอัตโนมัติ สำหรับที่อื่น ให้นำเข้าตามวิธีที่แพลตฟอร์มรองรับและส่งเข้ามาก่อนการตรวจสอบครั้งแรก:

```js
import { setHashwxModule } from "capjs-core";
import hashwxModule from "capjs-core/hashwx.wasm";

setHashwxModule(hashwxModule);
```

## การป้องกัน replay {#replay-prevention}

`validateChallenge` เรียก `consumeNonce(signature, ttlMs)` เมื่อ proof-of-work ผ่าน และก่อนตรวจสอบ instrumentation เก็บลายเซ็นหากยังไม่เคยมีและคืน `true` คืน `false` หากใช้แล้ว คำขอที่มี proof-of-work ผิดจะไม่มาถึงขั้นตอนนี้ จึงใช้ challenge ของผู้เข้าชมตัวจริงทิ้งไม่ได้ คำขอที่มี proof-of-work ถูกต้องแต่ instrumentation ไม่ผ่านจะใช้ challenge นั้นทิ้ง ทำให้บอตลองตรวจ instrumentation ซ้ำด้วย proof-of-work เดิมไม่ได้

::: code-group

```js [Redis]
const consumeNonce = async (sig, ttlMs) =>
  (await redis.set(`cap:${sig}`, "1", "NX", "PX", ttlMs)) === "OK";
```

```js [Workers KV]
const consumeNonce = async (sig, ttlMs) => {
  if (await env.NONCES.get(`cap:${sig}`)) return false;
  await env.NONCES.put(`cap:${sig}`, "1", { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) });
  return true;
};
```

```js [Postgres]
const consumeNonce = async (sig, ttlMs) => {
  try {
    await sql`INSERT INTO cap_nonces (sig, expires_at) VALUES (${sig}, ${new Date(Date.now() + ttlMs)})`;
    return true;
  } catch (e) {
    if (e.code === "23505") return false;
    throw e;
  }
};
```

:::

Workers KV ไม่เป็น atomic ดังนั้นคำขอสองรายการที่มาถึงพร้อมกันอาจผ่านทั้งคู่ ใช้ Durable Object หากเรื่องนี้มีผลกับคุณ

## Instrumentation

`instrumentation: true` เพิ่ม [challenge แบบ instrumentation](./instrumentation.md) ให้ challenge รูปแบบ 1 สำหรับรูปแบบ 2 ให้เพิ่ม `"instrumentation"` ใน `protocols` ทั้งสองกรณีส่งอ็อบเจกต์แทน `true` ได้:

```js
instrumentation: {
  blockAutomatedBrowsers: true,
  obfuscationLevel: 3,
}
```

| ตัวเลือก | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| `blockAutomatedBrowsers` | `false` | ปฏิเสธการแก้จาก[เบราว์เซอร์อัตโนมัติ](./instrumentation.md#automated-browser-detection) ด้วย `instr_automated_browser` |
| `detectAutomatedInteractions` | `false` | เพิ่ม `interaction_synthetic_clicks` และ `interaction_synthetic_keydowns` ใน `riskFlags` ดู[การตรวจจับปฏิสัมพันธ์](./instrumentation.md#interaction-detection) |
| `blockAutomatedInteractions` | `false` | ปฏิเสธการแก้เหล่านั้นด้วย `instr_automated_interaction` และเปิดการตรวจจับด้วย |
| `obfuscationLevel` | `5` | ตั้งแต่ 1 ถึง 10 ระดับ 1 ถึง 3 ลบช่องว่าง ระดับ 4 ถึง 7 เข้ารหัสสตริงและย่อสคริปต์เพิ่มด้วย และระดับ 8 ถึง 10 รัน `javascript-obfuscator` เมื่อติดตั้งไว้ ระดับที่สูงขึ้นใช้เวลาสร้างนานขึ้น |

ระดับ 8 ถึง 10 ต้องใช้แพ็กเกจเสริม `javascript-obfuscator` และบล็อก event loop หลายสิบมิลลิวินาทีต่อ challenge จึงควรใช้เฉพาะเส้นทางที่มีปริมาณคำขอน้อย หรือสร้างสคริปต์ใน worker pool ด้วย `instrumentationGenerator` ซึ่งรับตัวเลือก instrumentation และต้อง resolve เป็นค่าที่ `generateInstrumentation` คืน

## พฤติกรรมและเอเจนต์ {#behavior-and-agents}

`behavior` เปิด[การให้คะแนนพฤติกรรม](./instrumentation.md#behavior-scoring)และ[การบล็อกเอเจนต์](./instrumentation.md#ai-agent-detection) มันเพิ่ม challenge แบบ instrumentation หากยังไม่มี และนโยบายจะถูกลงลายเซ็นไว้ใน challenge token ไคลเอนต์จึงปิดมันไม่ได้

```js
await generateChallenge(SECRET, {
  format: 2,
  protocols: ["hashwx", "instrumentation"],
  behavior: { block: true, blockAgents: "identified" },
});
```

`behavior: true` ให้คะแนนโดยไม่บล็อก อ็อบเจกต์รับตัวเลือกดังนี้:

| ตัวเลือก | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| `block` | `false` | ปฏิเสธผล `automated` ด้วย `behavior_automated` และผล `no_interaction` ด้วย `behavior_no_interaction` |
| `threshold` | `0.75` | คะแนนตั้งแต่ 0.1 ถึง 1 ที่จะเปลี่ยนผลเป็น `automated` |
| `strict` | `false` | ยกเลิกเพดาน 0.6 ของคะแนนที่มาจากแฟล็กอ่อนเท่านั้น |
| `requireInteraction` | `true` | ตั้งเป็น `false` เพื่อให้ `no_interaction` ผ่านเมื่อเปิด `block` สำหรับโหมดล่องหนและโหมดลอย |
| `blockAgents` | `false` | `"identified"` ปฏิเสธเอเจนต์ที่ตรวจพบด้วยความเชื่อมั่นสูง และ `"all"` ปฏิเสธทุกเอเจนต์ที่ตรวจพบ ด้วย `behavior_agent` |
| `allowVerifiedAgents` | `false` | อนุญาตให้เอเจนต์ที่มีลายเซ็น Web Bot Auth ที่ตรวจสอบแล้วผ่าน `blockAgents` |

การแก้ที่ไม่มีข้อมูลพฤติกรรมจะล้มเหลวด้วย `behavior_missing` เสมอ ไม่ว่านโยบายจะเป็นอย่างไร

หากต้องการใช้ส่วนหัวคำขอเป็นหลักฐานของเอเจนต์ ให้ส่งคำขอ `/redeem` ให้ `validateChallenge`:

```js
const result = await validateChallenge(SECRET, body, {
  consumeNonce,
  request: { method: req.method, url: fullUrl, headers: req.headers },
  verifyWebBotAuth: true,
});
```

`url` ต้องเป็น URL เต็ม เพราะ Web Bot Auth ลงลายเซ็นครอบคลุมมัน เมื่อใช้ `verifyWebBotAuth: true` คำขอที่มีส่วนหัว `Signature-Agent` จะถูกตรวจสอบกับไดเรกทอรีคีย์ของเอเจนต์ ซึ่ง `validateChallenge` ดึงผ่าน HTTPS และแคชไว้หนึ่งชั่วโมง มันเชื่อถือเฉพาะผู้ลงลายเซ็นที่ Cap รู้จักและ origin ใน `trustedSignatureAgents` ส่ง `webBotAuthNonceCheck(nonce, ttlMs)` เพื่อปฏิเสธลายเซ็นที่นำมาใช้ซ้ำ มันทำงานเหมือน `consumeNonce`

`behaviorReplayCheck(digest, ttlMs)` ทำงานในลักษณะเดียวกันกับข้อมูลพฤติกรรม คืน `true` หากเคยพบ digest นี้แล้ว และข้อมูลพฤติกรรมจะได้รับ `bh_replayed` เฉพาะข้อมูลที่มีการเคลื่อนตัวชี้และการกดแป้นรวมกันตั้งแต่ 8 ครั้งขึ้นไปเท่านั้นที่มี digest

เมื่อเปิด behavior ผลสำเร็จจะมี `behavior: { score, verdict, flags, signals, agent }` เมื่อปิด `agent` จะคืนในระดับบนสุดทุกครั้งที่มีหลักฐาน โดยสร้างจากร่องรอยในหน้าและส่วนหัวเท่านั้น และจะไม่บล็อก ไม่ว่ากรณีใด เอเจนต์ที่ตรวจพบจะเพิ่ม `agent:<name>` ใน `riskFlags` โดย `agent` มีหน้าตาดังนี้:

```js
{
  detected: true,
  name: "claude-in-chrome",
  confidence: "high",
  verified: false,
  evidence: ["artifact:cic_active"],
}
```

## API

### `generateChallenge(secret, options?)`

| ตัวเลือก | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| `challengeCount` | `50` | จำนวนปริศนา SHA-256 ต่อ challenge |
| `challengeSize` | `32` | ความยาว salt เป็นอักขระฐานสิบหก |
| `challengeDifficulty` | `4` | ความยาว prefix ของแฮชที่ต้องการ เป็นอักขระฐานสิบหก |
| `expiresMs` | `600_000` | เวลาที่ผู้เข้าชมมีสำหรับแก้ |
| `scope` | ไม่มี | สตริงที่ผูกกับ challenge การตรวจสอบต้องส่งค่าเดียวกัน |
| `extra` | ไม่มี | ข้อมูลที่ฝังใน JWT ใครที่มี token ก็อ่านได้ |
| `instrumentation` | `false` | ดู [instrumentation](#instrumentation) |
| `instrumentationGenerator` | `generateInstrumentation` | ฟังก์ชัน async ที่สร้างสคริปต์ instrumentation |
| `behavior` | `false` | ดู[พฤติกรรมและเอเจนต์](#behavior-and-agents) |
| `format`, `protocols` | รูปแบบ 2 กับ HashWX | ดู [HashWX](#format-2-hashwx) การส่ง `keypair` หรือ `rsw` โดยไม่มี `protocols` จะใช้โปรโตคอล RSW ที่เลิกใช้แล้ว |
| `hashwxDifficulty`, `hashwxChallengeCount`, `hashwxNoncesPerHash` | ดู [HashWX](#format-2-hashwx) | การตั้งค่า HashWX สำหรับรูปแบบ 2 |
| `keypair`, `t`, `rsw` | ไม่มี | การตั้งค่าสำหรับโปรโตคอล RSW ที่เลิกใช้แล้ว |

รูปแบบ 1 คืน `{ challenge, token, expires, instrumentation? }` และรูปแบบ 2 คืน `{ token, format: 2, challenges, expires }` ทั้งคู่เพิ่ม `behavior: true` เมื่อเปิดการให้คะแนนพฤติกรรม ส่งอ็อบเจกต์ทั้งหมดให้วิดเจ็ต

### `validateChallenge(secret, body, options?)`

`body` คือข้อมูลที่วิดเจ็ตโพสต์ไปยัง `/redeem` ตัวเลือกมีดังนี้:

| ตัวเลือก | ค่าเริ่มต้น | หน้าที่ |
| --- | --- | --- |
| `consumeNonce` | ไม่มี | ดู[การป้องกัน replay](#replay-prevention) |
| `scope` | ไม่มี | ต้องตรงกับ scope ของ challenge |
| `tokenTtlMs` | `1_200_000` | ระยะเวลาที่ token ของผู้เข้าชมยังใช้ได้ |
| `signToken` | `id:secret` | ฟังก์ชันที่รับ `{ scope, expires, iat }` และคืน token ของคุณเอง โดยจะไม่มี `tokenKey` |
| `request` | ไม่มี | คำขอ `/redeem` ในรูป `{ method, url, headers }` ดู[พฤติกรรมและเอเจนต์](#behavior-and-agents) |
| `verifyWebBotAuth` | `false` | ตรวจสอบลายเซ็น Web Bot Auth บน `request` |
| `fetch` | `fetch` ส่วนกลาง | ใช้ดาวน์โหลดไดเรกทอรีคีย์ Web Bot Auth |
| `trustedSignatureAgents` | ไม่มี | origin ของผู้ลงลายเซ็นเพิ่มเติมที่เชื่อถือ เช่น `"https://agent.example.com"` |
| `webBotAuthNonceCheck` | ไม่มี | ปฏิเสธลายเซ็น Web Bot Auth ที่นำมาใช้ซ้ำ |
| `behaviorReplayCheck` | ไม่มี | ตั้งแฟล็กข้อมูลพฤติกรรมที่นำมาใช้ซ้ำ |

เมื่อสำเร็จ จะคืน `{ success: true, token, tokenKey, expires, scope, iat, riskFlags }` พร้อม `behavior` หรือ `agent` ตามที่อธิบายใน[พฤติกรรมและเอเจนต์](#behavior-and-agents) โดย `riskFlags` แสดงสัญญาณที่ไม่บล็อกด้วยตัวมันเอง เช่น `native_tamper` หรือ `legacy_widget` เพื่อให้คุณเพิ่มความยากสำหรับผู้เข้าชมคนนั้นได้ หน้า instrumentation แสดง[แฟล็กการตรวจสอบเบราว์เซอร์](./instrumentation.md#automated-browser-detection)และ[แฟล็กพฤติกรรม](./instrumentation.md#behavior-scoring)

เมื่อล้มเหลว จะคืน `{ success: false, reason }` ความล้มเหลวของ instrumentation มี `instr_error: true` ด้วย ส่วน `instr_automated_browser` และ `instr_automated_interaction` มีรายการ `blockedBy` และความล้มเหลวของพฤติกรรมมี `behavior` ทุก `reason` อยู่ใน[ตารางรหัสข้อผิดพลาด](./error-codes.md)

### export ระดับล่าง {#lower-level-exports}

capd และการทดสอบใช้สิ่งเหล่านี้ คุณต้องใช้เฉพาะเมื่อสร้างกระบวนการทำงานของคุณเอง

| Export | หน้าที่ |
| --- | --- |
| `generateInstrumentation(opts?)` | สร้างสคริปต์ instrumentation และข้อมูลกำกับสำหรับตรวจสอบ |
| `verifyInstrumentationResult(meta, payload, now?)` | ตรวจสอบผลลัพธ์กับข้อมูลกำกับนั้น คืน `{ valid, reason?, riskFlags?, blockedBy?, checks?, agent?, trace? }` |
| `serializeBound(data)`, `canonicalize(value)` | serialize ข้อมูลที่เก็บมาตามวิธีเดียวกับสคริปต์ |
| `boundValues(binding, serialized)` | ตัวเลขที่ผลลัพธ์ต้องมีสำหรับข้อมูลนั้น |
| `MAX_BOUND_DATA` | ความยาวสูงสุดของข้อมูลที่ serialize แล้วที่ยอมรับ คือ 65,536 อักขระ |
| `detectAutomation(vector)` | รันการตรวจสอบเบราว์เซอร์อัตโนมัติกับข้อมูลเบราว์เซอร์ที่คุณเก็บเอง คืน `{ pass, checks, blockedBy, riskFlags }` |
| `analyzeBehavior(trace, ctx?)` | ให้คะแนนข้อมูลพฤติกรรม โดย `ctx` รับ `{ replayed, strict, threshold }` คืน `{ score, verdict, flags, signals, digest }` |
| `BEHAVIOR_WEIGHTS`, `DEFAULT_BEHAVIOR_THRESHOLD`, `WEAK_CAP` | น้ำหนักของแฟล็ก, `0.75` และ `0.6` |
| `agentFromHeaders(headers)` | หลักฐานของเอเจนต์จาก `User-Agent`, `Signature-Agent` และ `Sec-CH-UA-Platform` |
| `agentFromTrace(trace)` | หลักฐานของเอเจนต์จากจังหวะการคลิกและการพิมพ์ในข้อมูลพฤติกรรม ส่งเฉพาะข้อมูลที่ `analyzeBehavior` ไม่ได้ตั้งแฟล็ก `bh_malformed` |
| `summarizeAgent(evidence, verification?)` | รวมหลักฐานและผล `verifyWebBotAuth` ที่ส่งเพิ่มได้เป็นอ็อบเจกต์ `agent` หรือ `null` หากไม่มีหลักฐาน |
| `verifyWebBotAuth(req, opts?)` | ตรวจสอบลายเซ็น Web Bot Auth และ resolve เป็น `{ verified, agent?, origin?, keyid?, reason? }` |
| `parseSignatureAgent(value)` | แยกส่วนหัว `Signature-Agent` เป็นรายการ `{ label, url }` |
| `hashwxReady()`, `setHashwxModule(module)` | คอมไพล์มอดูล HashWX ล่วงหน้า หรือจัดเตรียมมอดูลมาเอง ดู [HashWX](#format-2-hashwx) |
| `hashwxTarget(difficulty)`, `hashwxSeed(challenge, block)`, `hashwxHash(state, seed, nonce)` | ฟังก์ชันพื้นฐานของ HashWX โดย `state` มาจาก `hashwxReady()` |
| `DEFAULT_HASHWX_DIFFICULTY`, `DEFAULT_HASHWX_CHALLENGE_COUNT`, `DEFAULT_HASHWX_NONCES_PER_HASH` | `1_000_000`, `4` และ `65_536` |
| `generateRswKeypair(bits?)`, `serializeRswKeypair(kp)`, `deserializeRswKeypair(s)`, `buildRswMinter(args, opts?)` | คีย์และตัวสร้าง challenge สำหรับโปรโตคอล RSW ที่เลิกใช้แล้ว |

## การย้ายจาก `@cap.js/server` {#how-it-differs-from-cap-js-server}

`@cap.js/server` เป็นไลบรารีเดิมที่ไลบรารีนี้มาแทน มันเก็บ challenge และ token ในที่เก็บข้อมูลที่คุณกำหนด ส่วน `capjs-core` ไม่เก็บอะไรเลย challenge เป็น JWT ที่ลงลายเซ็น การป้องกัน replay ทำผ่าน `consumeNonce` และคุณเก็บ `tokenKey` เองตามที่แสดงใน[การตรวจสอบ token](#verifying-tokens) มันไม่แตะระบบไฟล์เลย จึงรันบน Workers และ Lambda ได้
