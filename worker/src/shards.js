/**
 * Key -> Durable Object shard mapping.
 *
 * Kept in its own module (no `cloudflare:workers` import) so it can be unit
 * tested outside a Worker.
 */

/**
 * Four shards. Rows written, not shard throughput, is the free plan's binding
 * limit, and every shard that holds data also arms alarms (billed as one row
 * written each), so fewer shards means less overhead. A power-of-two count
 * keeps the nibble -> shard mapping uniform.
 */
export const SHARD_COUNT = 4;

/**
 * Storage keys start with the challenge JWT signature in hex (a tenant suffix
 * such as `@demo` may follow), so the first character is already a uniformly
 * distributed nibble. Mapping it straight to a shard spreads writes without
 * hashing anything; a key always lands on the same shard, which is what makes
 * the per-key "insert if absent" / "consume exactly once" operations atomic.
 */
export function shardNameForKey(key) {
  const nibble = Number.parseInt(String(key).charAt(0), 16);
  const shard =
    Number.isInteger(nibble) && nibble >= 0 && nibble < 16
      ? nibble % SHARD_COUNT
      : 0;
  return `shard-${shard}`;
}
