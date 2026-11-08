import { Elysia } from "elysia";

import { db } from "#db";
import { requestContext } from "./events/context.js";
import { recordEvent } from "./events/index.js";
import { OLD_SECRET_ERROR } from "./hash-migration.js";
import { isCurrentHash, verifySecret } from "./secret-hash.js";

export const siteverifyServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
}).post(
  "/:siteKey?/siteverify",
  async ({ body, set, params, request, server: srv }) => {
    const secret = body?.secret;
    const response = body?.response;
    if (
      typeof secret !== "string" ||
      typeof response !== "string" ||
      !secret ||
      !response
    ) {
      set.status = 400;
      return { success: false, error: "Missing required parameters" };
    }
    const parts = response.split(":");
    if (parts.length !== 3 || parts.some((part) => !part)) {
      set.status = 400;
      return { success: false, error: "Missing required parameters" };
    }
    const sitekey = parts[0];
    if (params.siteKey && params.siteKey !== sitekey) {
      set.status = 404;
      return { success: false, error: "Invalid site key or secret" };
    }

    const secretHash = await db.hget(`key:${sitekey}`, "secretHash");

    if (!secretHash) {
      set.status = 404;
      return { success: false, error: "Invalid site key or secret" };
    }

    if (!isCurrentHash(secretHash)) {
      set.status = 403;
      return { success: false, error: OLD_SECRET_ERROR };
    }

    if (!verifySecret(secret, secretHash)) {
      set.status = 403;
      return { success: false, error: "Invalid site key or secret" };
    }

    const tokenKey = `token:${response}`;
    const stored = await db.getdel(tokenKey);

    const track = async (outcome, reason, record) => {
      const ctx = await requestContext(request, srv);
      recordEvent({
        site_key: sitekey,
        type: "siteverify",
        outcome,
        reason,
        ip: ctx.ip,
        country: ctx.country,
        asn: ctx.asn,
        asn_org: ctx.asn_org,
        token_id: response.split(":")[1],
        flags: Array.isArray(record?.f) ? record.f : [],
        score: record?.s ?? null,
        verdict: record?.v ?? "",
        agent: record?.a?.name ?? "",
        agent_confidence: record?.a?.confidence ?? "",
        agent_verified: record?.a?.verified ? 1 : 0,
        rule: [record?.r].flat()[0] ?? "",
      });
    };

    if (!stored) {
      track("fail", "token_not_found").catch(() => {});
      set.status = 404;
      return { success: false, error: "Token not found" };
    }

    let record = null;
    if (stored[0] === "{") {
      try {
        record = JSON.parse(stored);
      } catch {}
    }
    const expires = record ? record.e : stored;

    if (!(Number(expires) >= Date.now())) {
      track("fail", "token_expired", record).catch(() => {});
      set.status = 403;
      return { success: false, error: "Token expired" };
    }

    track("pass", "", record).catch(() => {});
    if (!record) return { success: true };
    return {
      success: true,
      riskFlags: Array.isArray(record.f) ? record.f : [],
      ...(record.v && {
        behavior: {
          score: record.s ?? null,
          verdict: record.v,
          ...(record.a && { agent: record.a }),
        },
      }),
      ...(!record.v && record.a && { agent: record.a }),
      ...(record.r && { rules: [record.r].flat() }),
    };
  },
);
