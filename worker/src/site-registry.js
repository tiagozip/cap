import { DurableObject } from "cloudflare:workers";

/**
 * Site registry and admin sessions, in one SQLite Durable Object instance
 * (`registryFor(env)`).
 *
 * A site is one embedder of the widget: its own site key (the
 * `/<siteKey>/challenge|redeem|siteverify` routes), its own siteverify secret
 * and its own browser origins. Only the sha256 of the secret is stored; the
 * plaintext is shown once, when the site is created or its secret rotated.
 *
 * Traffic never needs a write here: the Worker reads a site on a cache miss
 * (see `sites.js`) and caches it per isolate. Writes only come from the admin
 * console, so the free plan's rows-written budget is untouched by verification
 * traffic.
 */

const REGISTRY_NAME = "registry";

export function registryFor(env) {
  return env.SITE_REGISTRY.getByName(REGISTRY_NAME);
}

function rowToSite(row) {
  return {
    siteKey: row.site_key,
    name: row.name,
    secretHash: row.secret_hash,
    origins: JSON.parse(row.origins),
    settings: JSON.parse(row.settings),
    enabled: row.enabled === 1,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export class SiteRegistry extends DurableObject {
  #sql;

  constructor(ctx, env) {
    super(ctx, env);
    this.#sql = ctx.storage.sql;
    this.#sql.exec(
      `CREATE TABLE IF NOT EXISTS sites (
         site_key TEXT PRIMARY KEY,
         name TEXT NOT NULL,
         secret_hash TEXT NOT NULL,
         origins TEXT NOT NULL,
         settings TEXT NOT NULL,
         enabled INTEGER NOT NULL DEFAULT 1,
         created_at INTEGER NOT NULL,
         updated_at INTEGER NOT NULL
       ) WITHOUT ROWID`,
    );
    this.#sql.exec(
      `CREATE TABLE IF NOT EXISTS admin_sessions (
         id_hash TEXT PRIMARY KEY,
         sub TEXT NOT NULL,
         profile TEXT NOT NULL,
         expires INTEGER NOT NULL
       ) WITHOUT ROWID`,
    );
  }

  async getSite(siteKey) {
    const rows = this.#sql
      .exec("SELECT * FROM sites WHERE site_key = ?", siteKey)
      .toArray();
    return rows.length > 0 ? rowToSite(rows[0]) : null;
  }

  async listSites() {
    return this.#sql
      .exec("SELECT * FROM sites ORDER BY created_at, site_key")
      .toArray()
      .map(rowToSite);
  }

  /** Returns `false` when the site key is already taken. */
  async createSite({ siteKey, name, origins, settings, secretHash }) {
    const now = Date.now();
    this.#sql.exec(
      `INSERT INTO sites (site_key, name, secret_hash, origins, settings, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(site_key) DO NOTHING`,
      siteKey,
      name,
      secretHash,
      JSON.stringify(origins),
      JSON.stringify(settings),
      now,
      now,
    );
    return this.#sql.exec("SELECT changes() AS changed").one().changed === 1;
  }

  /** Applies the given fields; returns the updated site or `null`. */
  async updateSite(siteKey, patch) {
    const site = await this.getSite(siteKey);
    if (!site) return null;
    const next = {
      name: patch.name ?? site.name,
      origins: patch.origins ?? site.origins,
      settings: patch.settings ?? site.settings,
      enabled: patch.enabled ?? site.enabled,
    };
    this.#sql.exec(
      `UPDATE sites SET name = ?, origins = ?, settings = ?, enabled = ?, updated_at = ?
       WHERE site_key = ?`,
      next.name,
      JSON.stringify(next.origins),
      JSON.stringify(next.settings),
      next.enabled ? 1 : 0,
      Date.now(),
      siteKey,
    );
    return this.getSite(siteKey);
  }

  async setSecretHash(siteKey, secretHash) {
    this.#sql.exec(
      "UPDATE sites SET secret_hash = ?, updated_at = ? WHERE site_key = ?",
      secretHash,
      Date.now(),
      siteKey,
    );
    return this.#sql.exec("SELECT changes() AS changed").one().changed === 1;
  }

  async deleteSite(siteKey) {
    this.#sql.exec("DELETE FROM sites WHERE site_key = ?", siteKey);
    return this.#sql.exec("SELECT changes() AS changed").one().changed === 1;
  }

  async createSession(idHash, sub, profile, expires) {
    // Logins are rare, so expired sessions are swept here instead of by an
    // alarm.
    this.#sql.exec("DELETE FROM admin_sessions WHERE expires <= ?", Date.now());
    this.#sql.exec(
      "INSERT INTO admin_sessions (id_hash, sub, profile, expires) VALUES (?, ?, ?, ?)",
      idHash,
      sub,
      JSON.stringify(profile),
      expires,
    );
  }

  async getSession(idHash) {
    const rows = this.#sql
      .exec(
        "SELECT sub, profile, expires FROM admin_sessions WHERE id_hash = ? AND expires > ?",
        idHash,
        Date.now(),
      )
      .toArray();
    if (rows.length === 0) return null;
    return {
      sub: rows[0].sub,
      profile: JSON.parse(rows[0].profile),
      expires: Number(rows[0].expires),
    };
  }

  async deleteSession(idHash) {
    this.#sql.exec("DELETE FROM admin_sessions WHERE id_hash = ?", idHash);
  }
}
