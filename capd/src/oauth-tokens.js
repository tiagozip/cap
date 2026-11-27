import { createHash, randomBytes } from "node:crypto";
import { db } from "#db";

export const ACCESS_TTL = 3600;
export const GRANT_TTL = 90 * 86_400;

export const sha = (v) => createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) =>
  randomBytes(bytes).toString("base64url");

export const readJson = async (key) => {
  const raw = await db.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const writeJson = (key, value, ttl) =>
  db.send("SET", [key, JSON.stringify(value), "EX", String(ttl)]);

export async function verifyAccessToken(token) {
  const access = await readJson(`oauth:at:${sha(token)}`);
  if (!access) return null;
  const grant = await readJson(`oauth:grant:${access.grant}`);
  if (!grant) return null;
  if (Date.now() - (grant.lastUsed ?? 0) > 3_600_000)
    await writeJson(
      `oauth:grant:${grant.id}`,
      { ...grant, lastUsed: Date.now() },
      GRANT_TTL,
    );
  return {
    grant: grant.id,
    siteKeys: grant.siteKeys ?? null,
    readonly: grant.access === "read",
    oauth: true,
  };
}

const LOG = 100;

export async function logToolCall(grant, entry) {
  const key = `oauth:log:${grant}`;
  await db.send("LPUSH", [key, JSON.stringify(entry)]);
  await db.send("LTRIM", [key, "0", String(LOG - 1)]);
  await db.send("EXPIRE", [key, String(GRANT_TTL)]);
}

export const toolLog = async (grant) =>
  (
    (await db.send("LRANGE", [`oauth:log:${grant}`, "0", String(LOG - 1)])) ??
    []
  )
    .map((r) => {
      try {
        return JSON.parse(r);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
