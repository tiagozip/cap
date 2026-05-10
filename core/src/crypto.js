import crypto from "node:crypto";

const hasBunSha256 =
  typeof Bun !== "undefined" &&
  typeof Bun.SHA256 === "function" &&
  typeof Bun.SHA256.hash === "function";

export function randomHex(bytesCount) {
  return crypto.randomBytes(bytesCount).toString("hex");
}

export function sha256Hex(str) {
  if (hasBunSha256) return Bun.SHA256.hash(str, "hex");
  return crypto.createHash("sha256").update(str).digest("hex");
}

export function sha256Bytes(str) {
  if (hasBunSha256) return Bun.SHA256.hash(str);
  return crypto.createHash("sha256").update(str).digest();
}

export function hmacSha256(key, data) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

export function timingSafeEqual(a, b) {
  if (!Buffer.isBuffer(a)) a = Buffer.from(a);
  if (!Buffer.isBuffer(b)) b = Buffer.from(b);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function b64url(input) {
  const buf = Buffer.isBuffer(input)
    ? input
    : input instanceof Uint8Array
      ? Buffer.from(input)
      : Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

export function b64urlDecode(str) {
  return Buffer.from(str, "base64url");
}

const JWT_HEADER_B64 = b64url('{"alg":"HS256","typ":"JWT"}');

export function jwtSign(payloadOrJson, secret) {
  const json =
    typeof payloadOrJson === "string"
      ? payloadOrJson
      : JSON.stringify(payloadOrJson);
  const body = b64url(json);
  const sigInput = `${JWT_HEADER_B64}.${body}`;
  const sig = hmacSha256(secret, sigInput);
  return `${sigInput}.${b64url(sig)}`;
}

export function jwtVerify(token, secret) {
  if (!token || typeof token !== "string") return null;
  const firstDot = token.indexOf(".");
  if (firstDot < 1) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === firstDot) return null;
  if (token.indexOf(".", firstDot + 1) !== lastDot) return null;

  const sigInput = token.substring(0, lastDot);
  const expected = hmacSha256(secret, sigInput);
  const actual = b64urlDecode(token.substring(lastDot + 1));

  if (!timingSafeEqual(expected, actual)) return null;

  try {
    return JSON.parse(
      b64urlDecode(token.substring(firstDot + 1, lastDot)).toString("utf8"),
    );
  } catch {
    return null;
  }
}

export function jwtSigHex(token) {
  if (!token || typeof token !== "string") return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  try {
    return b64urlDecode(token.slice(lastDot + 1)).toString("hex");
  } catch {
    return null;
  }
}

function deriveKey(secret, info) {
  return hmacSha256(secret, info);
}

export function encryptGcm(data, secret, info = "cap:enc-v1") {
  const key = deriveKey(secret, info);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptGcm(blob, secret, info = "cap:enc-v1") {
  try {
    const buf = Buffer.from(blob, "base64url");
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const key = deriveKey(secret, info);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch {
    return null;
  }
}

export function parseHexPrefix(target) {
  const len = target.length;
  const fullBytes = len >> 1;
  const bytes = new Uint8Array(fullBytes);
  for (let i = 0; i < fullBytes; i++) {
    const a = target.charCodeAt(i * 2);
    const b = target.charCodeAt(i * 2 + 1);
    bytes[i] =
      ((a <= 57 ? a - 48 : (a | 32) - 87) << 4) |
      (b <= 57 ? b - 48 : (b | 32) - 87);
  }
  let partialNibble = -1;
  if (len & 1) {
    const c = target.charCodeAt(len - 1);
    partialNibble = c <= 57 ? c - 48 : (c | 32) - 87;
  }
  return { bytes, fullBytes, partialNibble };
}

export function powMatchesPrefix(hashBytes, parsed) {
  const { bytes, fullBytes, partialNibble } = parsed;
  for (let i = 0; i < fullBytes; i++) {
    if (hashBytes[i] !== bytes[i]) return false;
  }
  if (partialNibble !== -1) {
    if (hashBytes[fullBytes] >> 4 !== partialNibble) return false;
  }
  return true;
}
