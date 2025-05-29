import Elysia from "elysia";
import Cap from "@cap.js/server";
import fs from "fs/promises";
import crypto from "crypto";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const capMiddleware = function (userOptions) {
  const options = {
    token_validity_hours: 32,
    tokens_store_path: ".data/middlewareTokens.json",
    token_size: 16, // token size in bytes
    verification_template_path: join(
      dirname(fileURLToPath(import.meta.url)),
      "./index.html"
    ),
    scoping: "global", // 'global' | 'scoped'

    ...userOptions,
  };

  const cap = new Cap({
    noFSState: true,
  });

  let tokensCache = null;
  let cacheLastModified = 0;

  fs.mkdir(dirname(options.tokens_store_path), { recursive: true });

  async function loadCustomTokens() {
    try {
      const stats = await fs.stat(options.tokens_store_path);
      const fileModified = stats.mtime.getTime();

      if (tokensCache && fileModified <= cacheLastModified) {
        return tokensCache;
      }

      const fileContent = await fs.readFile(options.tokens_store_path, "utf-8");
      tokensCache = JSON.parse(fileContent);
      cacheLastModified = Date.now();
      return tokensCache;
    } catch {
      tokensCache = {};
      cacheLastModified = Date.now();
      return tokensCache;
    }
  }

  async function saveCustomTokens(tokens) {
    await fs.writeFile(options.tokens_store_path, JSON.stringify(tokens));
    tokensCache = tokens;
    cacheLastModified = Date.now();
  }

  async function storeCustomToken(token) {
    const tokens = await loadCustomTokens();

    tokens[token] = Date.now() + options.token_validity_hours * 60 * 60 * 1000;
    await saveCustomTokens(tokens);
    return token;
  }

  async function validateCustomToken(token) {
    const tokens = await loadCustomTokens();
    const tokenData = tokens[token];

    if (!tokenData) return { success: false };

    if (Date.now() > tokenData) {
      delete tokens[token];
      await saveCustomTokens(tokens);
      return { success: false };
    }

    return { success: true };
  }

  async function cleanupExpiredTokens() {
    const tokens = await loadCustomTokens();
    const now = Date.now();
    let hasChanges = false;

    for (const [token, data] of Object.entries(tokens)) {
      if (now > data) {
        delete tokens[token];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await saveCustomTokens(tokens);
    }
  }

  const plugin = new Elysia({
    name: "@cap.js/middleware-elysia",
    seed: options,
  });

  plugin.onBeforeHandle({ as: options.scoping }, async ({ path, cookie }) => {
    if (path === "/__cap_clearance/redeem") {
      return;
    }

    const customToken = cookie["__cap_clearance"]?.value;
    if (customToken) {
      const validation = await validateCustomToken(customToken);
      if (validation.success) {
        return;
      }
    }

    const challenge = cap.createChallenge();

    return new Response(
      (await fs.readFile(options.verification_template_path, "utf-8"))
        .replace("window.CAP_CHALLENGE", JSON.stringify(challenge))
        .replace("window.TOKEN_VALIDITY_HOURS", options.token_validity_hours)
        .replace(
          "{{TIME}}",
          new Date()
            .toISOString()
            .replace("T", " ")
            .replace(/\.\d+Z$/, "Z")
        ),
      {
        headers: { "Content-Type": "text/html" },
      }
    );
  });

  plugin.post("/__cap_clearance/redeem", async ({ body, set }) => {
    const { token, solutions } = body;

    if (!token || !solutions) {
      set.status = 400;
      return { success: false };
    }

    const challengeResult = await cap.redeemChallenge({ token, solutions });

    cap.validateToken(challengeResult.token);

    if (challengeResult.success) {
      const customToken = crypto
        .randomBytes(options.token_size)
        .toString("hex");
      await storeCustomToken(customToken);

      await cleanupExpiredTokens();

      return {
        success: true,
        token: customToken,
        expires: challengeResult.expires,
      };
    }

    return challengeResult;
  });

  return plugin;
};
