/**
 * Admin API for registered sites. Every route here runs behind
 * `readAdminSession` (see `admin/index.js`).
 *
 *   GET    /admin/api/sites               list (never includes secrets)
 *   POST   /admin/api/sites               { name, origins, settings? } -> site + secret (shown once)
 *   PATCH  /admin/api/sites/<key>         { name?, origins?, settings?, enabled? }
 *   POST   /admin/api/sites/<key>/rotate  -> new secret (shown once)
 *   DELETE /admin/api/sites/<key>
 */

import { createHash, randomBytes } from "node:crypto";
import { registryFor } from "../site-registry.js";
import {
  forgetSites,
  MAX_SITES,
  SITE_KEY_PATTERN,
  ValidationError,
  validateName,
  validateOrigins,
  validateSettings,
} from "../sites.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function publicSite(site) {
  const { secretHash: _secretHash, ...rest } = site;
  return rest;
}

function newSecret() {
  const secret = randomBytes(32).toString("hex");
  return {
    secret,
    secretHash: createHash("sha256").update(secret, "utf8").digest("hex"),
  };
}

async function readBody(request) {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw new ValidationError("invalid JSON body");
}

async function createSite(request, registry) {
  const body = await readBody(request);
  const name = validateName(body.name);
  const origins = validateOrigins(body.origins ?? []);
  if (origins.length === 0) {
    throw new ValidationError("at least one origin is required");
  }
  const settings = validateSettings(body.settings);
  if ((await registry.listSites()).length >= MAX_SITES) {
    throw new ValidationError(`at most ${MAX_SITES} sites`);
  }
  const { secret, secretHash } = newSecret();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const siteKey = randomBytes(5).toString("hex");
    if (
      await registry.createSite({
        siteKey,
        name,
        origins,
        settings,
        secretHash,
      })
    ) {
      forgetSites();
      const site = await registry.getSite(siteKey);
      return json({ site: publicSite(site), secret }, 201);
    }
  }
  return json({ error: "could not allocate a site key" }, 500);
}

async function updateSite(request, registry, siteKey) {
  const body = await readBody(request);
  const patch = {};
  if ("name" in body) patch.name = validateName(body.name);
  if ("origins" in body) {
    patch.origins = validateOrigins(body.origins);
    if (patch.origins.length === 0) {
      throw new ValidationError("at least one origin is required");
    }
  }
  if ("settings" in body) patch.settings = validateSettings(body.settings);
  if ("enabled" in body) {
    if (typeof body.enabled !== "boolean") {
      throw new ValidationError("enabled must be a boolean");
    }
    patch.enabled = body.enabled;
  }
  const site = await registry.updateSite(siteKey, patch);
  forgetSites();
  if (!site) return json({ error: "site not found" }, 404);
  return json({ site: publicSite(site) });
}

/** Routes `/admin/api/sites…`; `null` when nothing matches. */
export async function handleSitesApi(request, env, pathname) {
  const registry = registryFor(env);
  const parts = pathname.split("/").slice(4); // "", admin, api, sites, …
  const method = request.method;

  try {
    if (parts.length === 0) {
      if (method === "GET") {
        const sites = await registry.listSites();
        return json({ sites: sites.map(publicSite) });
      }
      if (method === "POST") return await createSite(request, registry);
      return json({ error: "method not allowed" }, 405);
    }

    const siteKey = parts[0];
    if (!SITE_KEY_PATTERN.test(siteKey)) return null;

    if (parts.length === 1) {
      if (method === "PATCH")
        return await updateSite(request, registry, siteKey);
      if (method === "DELETE") {
        const deleted = await registry.deleteSite(siteKey);
        forgetSites();
        return deleted
          ? json({ ok: true })
          : json({ error: "site not found" }, 404);
      }
      return json({ error: "method not allowed" }, 405);
    }

    if (parts.length === 2 && parts[1] === "rotate") {
      if (method !== "POST") return json({ error: "method not allowed" }, 405);
      const { secret, secretHash } = newSecret();
      const updated = await registry.setSecretHash(siteKey, secretHash);
      forgetSites();
      return updated
        ? json({ secret })
        : json({ error: "site not found" }, 404);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return json({ error: error.message }, 400);
    }
    throw error;
  }
  return null;
}
