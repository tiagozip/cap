import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const VERSION = "v1";
const SALT = "cap-secret-v1";

const keyFor = (siteKey) =>
  Buffer.from(hkdfSync("sha256", process.env.ADMIN_KEY, SALT, siteKey, 32));

export function sealSecret(siteKey, secret) {
  if (!process.env.ADMIN_KEY) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(siteKey), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [VERSION, iv, ciphertext, cipher.getAuthTag()]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(":");
}

export function openSecret(siteKey, sealed) {
  if (!process.env.ADMIN_KEY || typeof sealed !== "string") return null;
  const [version, iv, ciphertext, tag] = sealed.split(":");
  if (version !== VERSION || !iv || !ciphertext || !tag) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      keyFor(siteKey),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
