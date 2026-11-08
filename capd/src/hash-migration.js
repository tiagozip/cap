import { db } from "#db";
import { isCurrentHash } from "./secret-hash.js";

export const OLD_SECRET_ERROR =
  "This key's secret was made by an older Cap release, and Cap no longer accepts it. Reset the secret on the key's Settings page under Danger zone, then put the new one in your server's environment.";
export const OLD_API_KEY_ERROR =
  "This API key was made by an older Cap release, and Cap no longer accepts it. Create a new one under Settings > API keys and delete this one.";

const outdated = async (set, prefix, field) => {
  const ids = await db.smembers(set);
  const hashes = await Promise.all(
    ids.map((id) => db.hget(`${prefix}:${id}`, field)),
  );
  return ids.filter((_, i) => hashes[i] && !isCurrentHash(hashes[i]));
};

export async function migrateOldHashes() {
  const sessions = await db.smembers("sessions");
  const oldSessions = sessions.filter((h) => !/^[0-9a-f]{64}$/.test(h));
  await Promise.all(
    oldSessions.flatMap((h) => [
      db.srem("sessions", h),
      db.del(`session:${h}`),
    ]),
  );
  if (oldSessions.length)
    console.warn(
      `[cap] signed out ${oldSessions.length} dashboard ${oldSessions.length === 1 ? "session" : "sessions"} from an older release. Log in again with ADMIN_KEY.`,
    );

  const keys = await outdated("keys", "key", "secretHash");
  if (keys.length)
    console.warn(
      `[cap] ${keys.length} site ${keys.length === 1 ? "key has a secret" : "keys have secrets"} from an older release that Cap no longer accepts, so /siteverify fails for ${keys.length === 1 ? "it" : "them"}: ${keys.join(", ")}. Reset each secret on the key's Settings page under Danger zone.`,
    );

  const apiKeys = await outdated("apikeys", "apikey", "tokenHash");
  if (apiKeys.length)
    console.warn(
      `[cap] ${apiKeys.length} API ${apiKeys.length === 1 ? "key is" : "keys are"} from an older release and Cap no longer accepts ${apiKeys.length === 1 ? "it" : "them"}: ${apiKeys.join(", ")}. Create new ones under Instance settings > API keys.`,
    );

  return { sessions: oldSessions.length, keys, apiKeys };
}
