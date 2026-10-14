import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Server-to-server verification helpers, shared by `/siteverify` and the demo
 * page's same-origin shortcut.
 *
 * The request/response contract mirrors `standalone/src/siteverify.js`
 * (`{ secret, response }` -> `{ success }`, same status codes and error
 * strings) so the dashboard's Node snippet keeps working unchanged.
 *
 * Redeem tokens are `<challenge-signature-hex>:<secret>` (see `handlers.js`).
 * The signature is the storage key (issued by the Worker's own `signToken`
 * hook); the secret is only ever stored as a sha256 hash, and a token is
 * consumed with a single conditional UPDATE, which is what makes verification
 * both atomic and single use.
 */

/**
 * Compares two secrets without leaking their contents or their length through
 * timing. Both sides are hashed to a fixed 32 bytes first, then compared with
 * `timingSafeEqual`.
 */
export function constantTimeSecretMatch(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string")
    return false;
  if (provided.length === 0 || expected.length === 0) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Splits a redeem token (`<signature>:<secret>`) into its parts. Returns `null`
 * for anything that is not exactly two non-empty segments, or whose signature
 * is not hex: the storage key is the signature plus a tenant suffix
 * (`@demo`, `@<siteKey>`), so a signature carrying its own `@…` could
 * otherwise address another tenant's row.
 */
export function parseRedeemToken(token) {
  if (typeof token !== "string") return null;
  const separator = token.indexOf(":");
  if (separator <= 0 || separator !== token.lastIndexOf(":")) return null;
  const id = token.slice(0, separator);
  const secret = token.slice(separator + 1);
  if (!id || !secret || !/^[0-9a-f]+$/.test(id)) return null;
  return { id, secret };
}

/**
 * Storage key for a token signature. Each tenant (demo page, registered site)
 * appends its own suffix, so tokens of different tenants can never consume
 * each other's rows. A suffix, not a prefix: the key's first character picks
 * the shard (`shards.js`) and must stay the signature's first hex digit.
 */
export function storageKeyFor(id, keySuffix = "") {
  return `${id}${keySuffix}`;
}

/** Hash of the token secret; the raw secret never reaches the store. */
export function tokenSecretHash(secret) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Single-use consumption of a redeem token.
 *
 * `consumeToken(key, secretHash)` must atomically consume the key and return
 * its expiry (epoch ms) or `null`. The token is consumed before the expiry
 * check so a stale token cannot be replayed after it expires either.
 */
export async function consumeRedeemToken(
  token,
  consumeToken,
  keySuffix = "",
) {
  const parsed = parseRedeemToken(token);
  if (!parsed) {
    return { ok: false, status: 400, error: "Missing required parameters" };
  }

  const key = storageKeyFor(parsed.id, keySuffix);
  const expires = await consumeToken(key, tokenSecretHash(parsed.secret));
  if (expires === null || expires === undefined) {
    return { ok: false, status: 404, error: "Token not found" };
  }
  if (Number(expires) < Date.now()) {
    return { ok: false, status: 403, error: "Token expired" };
  }
  return { ok: true, status: 200 };
}
