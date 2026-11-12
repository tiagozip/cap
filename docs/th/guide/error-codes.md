---
description: "รหัสข้อผิดพลาดทั้งหมดที่วิดเจ็ต Cap, capjs-core และ capd ส่งกลับ พร้อมความหมายและที่มา"
---

# รหัสข้อผิดพลาด

ตารางนี้มีไว้สำหรับเจ้าของไซต์ วิดเจ็ตใส่รหัสเหล่านี้ใน `code` ของเหตุการณ์ `error` ส่วน `validateChallenge` คืนค่าเป็น `reason` และ capd แสดงเป็นเหตุผลในเหตุการณ์ที่ถูกบล็อกและไม่ผ่าน

| รหัส | ที่มา | ความหมาย |
| --- | --- | --- |
| `missing_endpoint` | วิดเจ็ต | วิดเจ็ตไม่มีทั้ง `data-cap-api-endpoint` และ `CAP_CUSTOM_FETCH` |
| `network_error` | วิดเจ็ต | endpoint ของ challenge คืนข้อผิดพลาด หรือไม่มี challenge ส่งมา |
| `challenge_parse_error` | วิดเจ็ต | คำตอบของ challenge ไม่ใช่ JSON |
| `challenge_unsupported` | วิดเจ็ต | challenge ใช้โปรโตคอลที่วิดเจ็ตรุ่นนี้แก้ไม่ได้ หรือใช้ HashWX ในเบราว์เซอร์ที่ไม่มี WebAssembly |
| `solve_failed` | วิดเจ็ต | worker ที่แก้ challenge ทำงานไม่สำเร็จ คำขอส่งไปไม่ถึงเซิร์ฟเวอร์ หรือข้อผิดพลาดไม่มีรหัสของตัวเอง |
| `redeem_failed` | วิดเจ็ต | คำตอบของ `/redeem` ไม่ใช่ JSON |
| `invalid_solution` | วิดเจ็ต, เซิร์ฟเวอร์ | เซิร์ฟเวอร์ปฏิเสธการแลก token ในวิดเจ็ต `message` ของเหตุการณ์คือ `error` ของเซิร์ฟเวอร์ ส่วนเมื่อมาจากเซิร์ฟเวอร์ หมายถึง proof-of-work ไม่ถูกต้อง |
| `invalid_expires` | วิดเจ็ต | เวลาหมดอายุของ token ไม่อยู่ภายใน 24 ชั่วโมงข้างหน้า ซึ่งบ่งชี้ว่านาฬิกาของเซิร์ฟเวอร์ไม่ถูกต้อง |
| `instr_csp_blocked` | วิดเจ็ต, เซิร์ฟเวอร์ | Content Security Policy ของหน้าบล็อกสคริปต์ instrumentation ให้ตั้ง `CAP_SCRIPT_NONCE` ตามที่อธิบายไว้ใน [Content Security Policy](./widget.md#content-security-policy) |
| `instr_natives_tampered` | วิดเจ็ต, เซิร์ฟเวอร์ | ฟังก์ชันของเบราว์เซอร์ที่สคริปต์ต้องใช้ถูกส่วนขยายหรือสคริปต์บนหน้าแทนที่ก่อนเริ่มรัน |
| `instr_env_failed` | วิดเจ็ต, เซิร์ฟเวอร์ | การตรวจสอบสภาพแวดล้อมไม่ผ่านก่อนโปรแกรมเริ่มรัน สคริปต์ไม่ได้รันในหน้าเบราว์เซอร์จริง หรือมีบางอย่างเปลี่ยนเฟรม |
| `instr_script_failed` | วิดเจ็ต, เซิร์ฟเวอร์ | โปรแกรมโยนข้อผิดพลาดหลังจากผ่านการตรวจสอบสภาพแวดล้อมแล้ว |
| `instr_blocked` | วิดเจ็ต | การตรวจสอบเบราว์เซอร์อัตโนมัติของสคริปต์เองไม่ผ่าน เซิร์ฟเวอร์บันทึก `instr_automated_browser` หากคีย์บล็อกเบราว์เซอร์อัตโนมัติ และ `instr_failed` หากไม่ได้บล็อก |
| `instr_timeout` | วิดเจ็ต, เซิร์ฟเวอร์ | สคริปต์ไม่ตอบภายใน 20 วินาทีหลังวิดเจ็ตสั่งให้จบ |
| `invalid_body`, `missing_token`, `missing_solutions`, `invalid_solutions` | เซิร์ฟเวอร์ | คำขอ `/redeem` มีรูปแบบไม่ถูกต้อง |
| `invalid_token` | เซิร์ฟเวอร์ | token ของ challenge ถูกปลอม มีรูปแบบไม่ถูกต้อง หรือลงนามด้วย secret อื่น |
| `scope_mismatch` | เซิร์ฟเวอร์ | token เป็นของคีย์ไซต์หรือ scope อื่น |
| `expired` | เซิร์ฟเวอร์ | challenge หมดอายุก่อนนำมาแลก token |
| `already_redeemed` | เซิร์ฟเวอร์ | challenge ถูกใช้ไปแล้ว การตรวจสอบ instrumentation ที่ไม่ผ่านก็ทำให้ใช้ไปแล้วเช่นกัน |
| `nonce_store_error` | เซิร์ฟเวอร์ | `consumeNonce` โยนข้อผิดพลาด |
| `instr_missing` | เซิร์ฟเวอร์ | คำขอไม่มีผลลัพธ์ instrumentation |
| `instr_corrupted` | เซิร์ฟเวอร์ | เซิร์ฟเวอร์ถอดรหัสข้อมูล instrumentation ของ challenge ไม่ได้ ซึ่งมักเกิดจาก secret เปลี่ยนไป |
| `instr_expired` | เซิร์ฟเวอร์ | ผลลัพธ์ instrumentation มาถึงหลัง challenge หมดอายุ |
| `instr_stale` | เซิร์ฟเวอร์ | ผลลัพธ์อ้างว่าใช้เวลาเกินกว่าที่ challenge อนุญาต |
| `instr_oversized` | เซิร์ฟเวอร์ | ข้อมูลที่เก็บมามีขนาดเกิน 65,536 อักขระ |
| `id_mismatch` | เซิร์ฟเวอร์ | ผลลัพธ์เป็นของ challenge อื่น |
| `failed_challenge` | เซิร์ฟเวอร์ | ตัวเลขในผลลัพธ์ไม่ถูกต้อง โดยผลลัพธ์ถูกแก้ไข หรือเบราว์เซอร์คำนวณโปรแกรมไม่ถูกต้อง |
| `invalid_state`, `missing_output`, `missing_meta`, `invalid_meta` | เซิร์ฟเวอร์ | ผลลัพธ์หรือข้อมูล challenge ที่ปิดผนึกไว้มีรูปแบบไม่ถูกต้อง |
| `instr_failed` | เซิร์ฟเวอร์ | วิดเจ็ตรายงานความล้มเหลวที่เซิร์ฟเวอร์ไม่รู้จัก |
| `instr_automated_browser` | เซิร์ฟเวอร์ | [การตรวจสอบเบราว์เซอร์อัตโนมัติ](./instrumentation.md#automated-browser-detection)ไม่ผ่าน โดย `blockedBy` ระบุรายการที่ไม่ผ่าน |
| `instr_probe_missing` | เซิร์ฟเวอร์ | คีย์บล็อกเบราว์เซอร์อัตโนมัติ แต่ผลลัพธ์ไม่มีข้อมูลเบราว์เซอร์ |
| `instr_automated_interaction` | เซิร์ฟเวอร์ | สคริปต์ส่งการคลิกหรือการกดปุ่มตั้งแต่สามครั้งขึ้นไป ดู[การตรวจจับการโต้ตอบ](./instrumentation.md#interaction-detection) |
| `instr_host_unreachable` | เซิร์ฟเวอร์ | สคริปต์อ่านหน้ารอบเฟรมไม่ได้ และนโยบายของคีย์ต้องใช้ข้อมูลนั้น |
| `instr_isolated` | เซิร์ฟเวอร์ | หน้าตั้งค่า [`CAP_ISOLATE`](./widget.md#pages-with-an-html-injection-bug) และคีย์นี้ต้องใช้ข้อมูลการโต้ตอบ พฤติกรรม หรือ agent ที่เฟรมแบบแยกเก็บไม่ได้ ให้ปิดการบล็อกเหล่านั้นสำหรับคีย์นี้ หรือนำ `CAP_ISOLATE` ออก |
| `instr_wasm_available` | เซิร์ฟเวอร์ | วิดเจ็ตขอ[ทางถอย SHA-256](./hashwx.md#browsers-without-webassembly) แต่ WebAssembly คอมไพล์ได้ในเฟรมของการตรวจเบราว์เซอร์ |
| `instr_widget_outdated` | เซิร์ฟเวอร์ | [วิดเจ็ตจากรุ่นก่อนหน้า](./instrumentation.md#widgets-from-earlier-releases)ทำตามข้อกำหนดของคีย์นี้ไม่ได้ ให้อัปเดตวิดเจ็ต |
| `behavior_missing` | เซิร์ฟเวอร์ | เปิดการให้คะแนนพฤติกรรมไว้ แต่ผลลัพธ์ไม่มีข้อมูลพฤติกรรม |
| `behavior_automated` | เซิร์ฟเวอร์ | [คะแนนพฤติกรรม](./instrumentation.md#behavior-scoring)ถึงเกณฑ์ |
| `behavior_no_interaction` | เซิร์ฟเวอร์ | ไม่มีการกดวิดเจ็ต และคีย์บังคับให้มีการโต้ตอบ |
| `behavior_agent` | เซิร์ฟเวอร์ | ตรวจพบ [AI agent](./instrumentation.md#ai-agent-detection) และคีย์บล็อก agent นั้น |
| `rate_limited` | capd | ไคลเอนต์เกินอัตราคำขอที่คีย์กำหนด |
| `non_browser_ua`, `missing_header` | capd | คำขอ challenge ไม่ผ่านตัวกรองคำขอของคีย์ |
| `rule:<id>` | capd | กฎของคีย์บล็อกคำขอ |
| `signal:<flag>` | capd | คีย์ถูกตั้งให้บล็อกเมื่อมีแฟล็กความเสี่ยงนั้น |

คำตอบ `/redeem` ของ capd เปลี่ยนชื่อบางรหัสในฟิลด์ `reason` ของตัวเอง โดย `instr_automated_browser` เป็น `automated_browser_detected`, `instr_automated_interaction` เป็น `automated_interaction_detected`, `instr_corrupted` เป็น `corrupted_instrumentation_data`, `instr_missing` เป็น `missing_instrumentation_response`, `instr_expired` เป็น `expired` และ `instr_timeout` เป็น `timeout` พร้อมสถานะ `429`
