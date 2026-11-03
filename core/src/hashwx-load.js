import { HASHWX_WASM_BASE64 } from "./hashwx-wasm.js";

function decodeBase64(b64) {
  if (typeof Buffer !== "undefined")
    return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function loadHashwxModule() {
  return WebAssembly.compile(decodeBase64(HASHWX_WASM_BASE64));
}
