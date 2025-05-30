import Cap from "@cap.js/server";
import fs from "fs/promises";
import crypto from "crypto";

import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const capCheckpoint = function (userOptions) {
  const options = {
    token_validity_hours: 32,
    tokens_store_path: ".data/middlewareTokens.json",
    token_size: 16,
    verification_template_path: join(
      dirname(fileURLToPath(import.meta.url)),
      "./index.html"
    ),
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

      if (tokensCache && stats.mtime.getTime() <= cacheLastModified) {
        return tokensCache;
      }

      tokensCache = JSON.parse(
        await fs.readFile(options.tokens_store_path, "utf-8")
      );
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

  return async (req, res, next) => {
    const { path, method } = req;

    if (method === "POST" && path === "/__cap_clearance/redeem") {
      const { token, solutions } = req.body;

      if (!token || !solutions) {
        return res.status(400).json({ success: false });
      }

      const challengeResult = await cap.redeemChallenge({ token, solutions });

      cap.validateToken(challengeResult.token);

      if (challengeResult.success) {
        const customToken = crypto
          .randomBytes(options.token_size)
          .toString("hex");
        await storeCustomToken(customToken);

        await cleanupExpiredTokens();

        res.cookie("__cap_clearance", customToken, {
          maxAge: options.token_validity_hours * 60 * 60 * 1000,
          sameSite: "Strict",
        });

        return res.json({
          success: true,
          token: customToken,
          expires: challengeResult.expires,
        });
      }

      return res.json(challengeResult);
    }

    const customToken = req.cookies?.__cap_clearance;
    if (customToken) {
      const validation = await validateCustomToken(customToken);
      if (validation.success) {
        return next();
      }
    }

    const challenge = cap.createChallenge();

    const html = (
      await fs.readFile(options.verification_template_path, "utf-8")
    )
      .replace("window.CAP_CHALLENGE", JSON.stringify(challenge))
      .replace("window.TOKEN_VALIDITY_HOURS", options.token_validity_hours)
      .replace(
        "{{TIME}}",
        new Date()
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d+Z$/, "Z")
      );

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  };
};
