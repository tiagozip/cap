let wasm,
  imports = {};
imports.__wbindgen_placeholder__ = module.exports;
const { TextEncoder: TextEncoder } = require("util");
let WASM_VECTOR_LEN = 0,
  cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  return (
    (null !== cachedUint8ArrayMemory0 && 0 !== cachedUint8ArrayMemory0.byteLength) ||
      (cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer)),
    cachedUint8ArrayMemory0
  );
}
let cachedTextEncoder = new TextEncoder("utf-8");
const encodeString =
  "function" == typeof cachedTextEncoder.encodeInto
    ? function (e, n) {
        return cachedTextEncoder.encodeInto(e, n);
      }
    : function (e, n) {
        const t = cachedTextEncoder.encode(e);
        return (n.set(t), { read: e.length, written: t.length });
      };
function passStringToWasm0(e, n, t) {
  if (void 0 === t) {
    const t = cachedTextEncoder.encode(e),
      r = n(t.length, 1) >>> 0;
    return (
      getUint8ArrayMemory0()
        .subarray(r, r + t.length)
        .set(t),
      (WASM_VECTOR_LEN = t.length),
      r
    );
  }
  let r = e.length,
    o = n(r, 1) >>> 0;
  const s = getUint8ArrayMemory0();
  let a = 0;
  for (; a < r; a++) {
    const n = e.charCodeAt(a);
    if (n > 127) break;
    s[o + a] = n;
  }
  if (a !== r) {
    (0 !== a && (e = e.slice(a)), (o = t(o, r, (r = a + 3 * e.length), 1) >>> 0));
    const n = getUint8ArrayMemory0().subarray(o + a, o + r);
    ((a += encodeString(e, n).written), (o = t(o, r, a, 1) >>> 0));
  }
  return ((WASM_VECTOR_LEN = a), o);
}
((module.exports.solve_pow = function (e, n) {
  const t = passStringToWasm0(e, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc),
    r = WASM_VECTOR_LEN,
    o = passStringToWasm0(n, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc),
    s = WASM_VECTOR_LEN,
    a = wasm.solve_pow(t, r, o, s);
  return BigInt.asUintN(64, a);
}),
  (module.exports.__wbindgen_init_externref_table = function () {
    const e = wasm.__wbindgen_export_0,
      n = e.grow(4);
    (e.set(0, void 0),
      e.set(n + 0, void 0),
      e.set(n + 1, null),
      e.set(n + 2, !0),
      e.set(n + 3, !1));
  }));
const path = require("path").join(__dirname, "cap_wasm_bg.wasm"),
  bytes = require("fs").readFileSync(path),
  wasmModule = new WebAssembly.Module(bytes),
  wasmInstance = new WebAssembly.Instance(wasmModule, imports);
((wasm = wasmInstance.exports), (module.exports.__wasm = wasm), wasm.__wbindgen_start());
