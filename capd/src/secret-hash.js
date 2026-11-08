import { createHash, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256:";

const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");

export const tokenId = sha256Hex;

const HEX64 = /^[0-9a-f]{64}$/;

export function sameHex(a, b) {
  if (!HEX64.test(a) || !HEX64.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function hashSecret(secret) {
  return PREFIX + sha256Hex(secret);
}

export function isCurrentHash(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

export function verifySecret(secret, stored) {
  if (typeof secret !== "string" || typeof stored !== "string") return false;
  if (!stored.startsWith(PREFIX)) return false;
  return sameHex(sha256Hex(secret), stored.slice(PREFIX.length));
}
