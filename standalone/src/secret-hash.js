import { createHash, timingSafeEqual } from "node:crypto";

const PREFIX = "sha256:";

const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");

export function hashSecret(secret) {
  return PREFIX + sha256Hex(secret);
}

export function isFastHash(stored) {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}

// Returns { valid, legacy }. `legacy` is true when `stored` is an old
// password-KDF hash that verified successfully allowing the hash to be regenerated as SHA-256
export async function verifySecret(secret, stored) {
  if (isFastHash(stored)) {
    const a = Buffer.from(sha256Hex(secret), "hex");
    const b = Buffer.from(stored.slice(PREFIX.length), "hex");
    const valid = a.length === b.length && timingSafeEqual(a, b);
    return { valid, legacy: false };
  }

  // Legacy argon2/bcrypt hashes
  const valid = await Bun.password.verify(secret, stored);
  return { valid, legacy: valid };
}
