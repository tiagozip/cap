import { createHash, randomBytes } from "node:crypto";
import {
  generateChallenge as coreGenerateChallenge,
  validateChallenge as coreValidateChallenge,
} from "capjs-core";
import { Elysia } from "elysia";

import { db, incrWithTtl } from "#db";
import { requestContext } from "./events/context.js";
import { contextFields, recordEvent } from "./events/index.js";
import { evaluateRules, getRules } from "./policy/rules.js";
import { applySignalPolicy } from "./policy/signals.js";
import valkeyRateLimit from "./ratelimit.js";
import { getFiltering, getRatelimit } from "./settings-cache.js";

const DEFAULT_HASHWX_D = 1_000_000;
const MIN_HASHWX_D = 50_000;
const MAX_HASHWX_D = 5_000_000;

export function resolveProtocol(keyConfig) {
  const proto = keyConfig?.protocol;
  if (proto === "hashwx" || proto === "sha256-pow") return proto;
  return proto === "rsw" || keyConfig?.rsw ? "hashwx" : "sha256-pow";
}

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const MAX_REDEEM_BYTES = 256 * 1024;
const TOO_LARGE = Object.freeze({});
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const _keyCache = new Map();
const KEY_CACHE_TTL = 5_000;
const KEY_CACHE_MAX = 5_000;

async function getKeyFields(siteKey) {
  const cached = _keyCache.get(siteKey);
  if (cached && Date.now() - cached.ts < KEY_CACHE_TTL) return cached.fields;

  const [config, jwtSecret] = await db.hmget(`key:${siteKey}`, [
    "config",
    "jwtSecret",
  ]);
  const fields = { config: config ?? null, jwtSecret: jwtSecret ?? null };
  if (fields.config) {
    if (_keyCache.size >= KEY_CACHE_MAX) _keyCache.clear();
    _keyCache.set(siteKey, { fields, ts: Date.now() });
  }
  return fields;
}

export function invalidateKeyCache(siteKey) {
  if (siteKey) _keyCache.delete(siteKey);
  else _keyCache.clear();
}

async function velocity(siteKey, ctx, count = true) {
  const minute = Math.floor(Date.now() / 60_000);
  const keys = [
    [`vel:${siteKey}:ip:${ctx.ip}`, "ip_velocity"],
    [`vel:${siteKey}:v:${ctx.fp}`, "visitor_velocity"],
  ];
  const out = {};
  await Promise.all(
    keys.map(async ([base, field]) => {
      if (!count) {
        const [cur, prev] = (
          await db.mget(`${base}:${minute}`, `${base}:${minute - 1}`)
        ).map((v) => Number(v) || 0);
        const elapsed = (Date.now() % 60_000) / 60_000;
        out[field] = Math.round(cur + prev * (1 - elapsed));
        return;
      }
      const [cur, prev] = await Promise.all([
        incrWithTtl(`${base}:${minute}`, 130),
        db.get(`${base}:${minute - 1}`).then((v) => Number(v) || 0),
      ]);
      const elapsed = (Date.now() % 60_000) / 60_000;
      out[field] = Math.round(cur + prev * (1 - elapsed));
    }),
  );
  return out;
}

const limitedSeen = new Map();

const blockedReasons = new Set([
  "behavior_automated",
  "behavior_agent",
  "behavior_missing",
  "behavior_no_interaction",
  "instr_automated_browser",
  "instr_automated_interaction",
  "instr_wasm_available",
]);

export const capServer = new Elysia({
  detail: {
    tags: ["Challenges"],
  },
})
  .use(
    valkeyRateLimit({
      max: 30,
      duration: 5_000,
      getLimits: async (params) => {
        if (params?.siteKey) {
          const { config: configStr } = await getKeyFields(params.siteKey);
          if (configStr) {
            try {
              const config = JSON.parse(configStr);
              if (
                config.ratelimitMax != null &&
                config.ratelimitDuration != null
              ) {
                return {
                  max: config.ratelimitMax,
                  duration: config.ratelimitDuration,
                };
              }
            } catch {}
          }
        }
        const global = getRatelimit();
        return { max: global.max, duration: global.duration };
      },
      onLimited: async (request, ip, srv) => {
        const parts = new URL(request.url).pathname.split("/").filter(Boolean);
        const [siteKey, action] = parts;
        if (!siteKey || !(await getKeyFields(siteKey)).config) return;
        const seenKey = `${siteKey}|${ip}`;
        const now = Date.now();
        if (now - (limitedSeen.get(seenKey) ?? 0) < 5_000) return;
        if (limitedSeen.size > 20_000) limitedSeen.clear();
        limitedSeen.set(seenKey, now);
        const ctx = await requestContext(request, srv);
        recordEvent({
          ...contextFields(ctx),
          site_key: siteKey,
          type: action === "redeem" ? "redeem" : "challenge",
          outcome: "limit",
          reason: "rate_limited",
        });
      },
    }),
  )

  .post(
    "/:siteKey/challenge",
    async ({ set, params, query, request, server: srv }) => {
      const fields = await getKeyFields(params.siteKey);

      if (!fields.config) {
        set.status = 404;
        return { error: "Invalid site key or secret" };
      }

      const keyConfig = JSON.parse(fields.config);
      const ctx = await requestContext(request, srv);
      const noWasm =
        query?.wasm === "0" &&
        keyConfig.sha256Fallback === true &&
        resolveProtocol(keyConfig) === "hashwx";
      const protocol = noWasm ? "sha256-pow" : resolveProtocol(keyConfig);
      const base = {
        ...contextFields(ctx),
        site_key: params.siteKey,
        type: "challenge",
        protocol,
      };
      const block = (reason, extra = {}) => {
        recordEvent({ ...base, outcome: "block", reason, ...extra });
        set.status = 403;
        return { error: "Blocked" };
      };

      const rules = await getRules(params.siteKey);
      if (rules.needsVelocity && ctx.ip) {
        try {
          Object.assign(ctx, await velocity(params.siteKey, ctx));
        } catch {}
      }

      let decision = { action: null, flags: [], factor: 1 };
      try {
        decision = await evaluateRules(rules, ctx, "challenge");
      } catch (e) {
        console.error("[cap] rule evaluation failed:", e);
      }
      if (decision.action === "block") {
        return block(`rule:${decision.rule.id}`, {
          rule: decision.rule.id,
          flags: decision.flags,
        });
      }
      const allowed = decision.action === "allow";

      const jwtSecret = fields.jwtSecret;
      if (!jwtSecret) {
        set.status = 500;
        return { error: "Site key is not configured for JWT challenges" };
      }

      if (!allowed) {
        const globalFilter = getFiltering();
        const blockUA =
          keyConfig.blockNonBrowserUA ?? globalFilter.blockNonBrowserUA;
        const reqHeaders = keyConfig.requiredHeaders?.length
          ? keyConfig.requiredHeaders
          : globalFilter.requiredHeaders;

        if (
          blockUA &&
          (!ctx.ua ||
            !/Mozilla\/|Chrome\/|Safari\/|Firefox\/|Opera\/|Edg\//i.test(
              ctx.ua,
            ))
        ) {
          return block("non_browser_ua");
        }
        if (reqHeaders?.some((h) => !request.headers.get(h))) {
          return block("missing_header");
        }
      }

      const instrumentationOpts =
        keyConfig.instrumentation !== false
          ? {
              blockAutomatedBrowsers:
                !allowed && keyConfig.blockAutomatedBrowsers === true,
              detectAutomatedInteractions:
                keyConfig.detectAutomatedInteractions === true ||
                keyConfig.signalActions?.interaction_synthetic_clicks ===
                  "block" ||
                keyConfig.signalActions?.interaction_synthetic_keydowns ===
                  "block",
              blockAutomatedInteractions:
                !allowed &&
                (keyConfig.blockAutomatedInteractions === true ||
                  (keyConfig.signalActions?.interaction_synthetic_clicks ===
                    "block" &&
                    keyConfig.signalActions?.interaction_synthetic_keydowns ===
                      "block")),
              obfuscationLevel: keyConfig.obfuscationLevel,
              ...(noWasm && { noWasm }),
            }
          : false;

      const behaviorOpts =
        keyConfig.behavior === "report" || keyConfig.behavior === "block"
          ? {
              block: !allowed && keyConfig.behavior === "block",
              ...(keyConfig.behaviorThreshold && {
                threshold: keyConfig.behaviorThreshold,
              }),
              ...(keyConfig.behaviorStrict && { strict: true }),
              ...(keyConfig.requireInteraction !== true && {
                requireInteraction: false,
              }),
              blockAgents: false,
            }
          : false;

      const factor = decision.factor || 1;
      let challengeOpts;
      if (noWasm) {
        challengeOpts = {
          format: 2,
          protocols:
            keyConfig.instrumentation !== false
              ? ["sha256-pow", "instrumentation"]
              : ["sha256-pow"],
          challengeCount: Math.min(
            500,
            Math.round((keyConfig.challengeCount ?? 80) * factor),
          ),
          challengeSize: keyConfig.saltSize ?? 32,
          challengeDifficulty: keyConfig.difficulty ?? 4,
          expiresMs: CHALLENGE_TTL_MS,
          scope: params.siteKey,
          instrumentation: instrumentationOpts,
          behavior: behaviorOpts,
          extra: { pf: "sha256-pow" },
        };
      } else if (protocol === "hashwx") {
        const rawD =
          (Number(keyConfig.hashwxDifficulty) || DEFAULT_HASHWX_D) * factor;
        challengeOpts = {
          format: 2,
          protocols:
            keyConfig.instrumentation !== false
              ? ["hashwx", "instrumentation"]
              : ["hashwx"],
          hashwxDifficulty: Math.min(
            MAX_HASHWX_D,
            Math.max(MIN_HASHWX_D, Math.round(rawD)),
          ),
          expiresMs: CHALLENGE_TTL_MS,
          scope: params.siteKey,
          instrumentation: instrumentationOpts,
          behavior: behaviorOpts,
        };
      } else {
        challengeOpts = {
          challengeCount: Math.min(
            500,
            Math.round((keyConfig.challengeCount ?? 80) * factor),
          ),
          challengeSize: keyConfig.saltSize ?? 32,
          challengeDifficulty: keyConfig.difficulty ?? 4,
          expiresMs: CHALLENGE_TTL_MS,
          scope: params.siteKey,
          instrumentation: instrumentationOpts,
          behavior: behaviorOpts,
        };
      }

      let result;
      try {
        result = await coreGenerateChallenge(jwtSecret, challengeOpts);
      } catch (err) {
        console.error("[cap] generateChallenge failed:", err);
        set.status = 500;
        return { error: "Failed to generate challenge" };
      }

      recordEvent({
        ...base,
        outcome: "pass",
        reason:
          factor > 1
            ? `harder_x${factor}`
            : allowed
              ? `allowed:${decision.rule.id}`
              : "",
        rule: allowed ? decision.rule.id : (decision.matched?.[0] ?? ""),
        flags: noWasm ? [...decision.flags, "wasm_fallback"] : decision.flags,
      });

      return result;
    },
  )

  .post(
    "/:siteKey/redeem",
    async ({ body, set, params, request, server: srv }) => {
      if (body === TOO_LARGE) {
        set.status = 413;
        return { error: "Request body too large" };
      }
      if (!body?.token || !body.solutions) {
        set.status = 400;
        return { error: "Missing required fields" };
      }

      const { jwtSecret, config: configStr } = await getKeyFields(
        params.siteKey,
      );
      if (!jwtSecret) {
        set.status = 404;
        return { error: "Invalid site key" };
      }
      const keyConfig = JSON.parse(configStr);
      const ctx = await requestContext(request, srv);

      const result = await coreValidateChallenge(
        jwtSecret,
        {
          token: body.token,
          solutions: body.solutions,
          instr: body.instr,
          instr_blocked: body.instr_blocked,
          instr_timeout: body.instr_timeout,
        },
        {
          scope: params.siteKey,
          consumeNonce: async (sigHex, ttlMs) => {
            const ttlSecs = Math.max(1, Math.ceil(ttlMs / 1000));
            const claim = await db.send("SET", [
              `blocklist:${sigHex}`,
              "1",
              "NX",
              "EX",
              String(ttlSecs),
            ]);
            return claim === "OK";
          },
          signToken: () => {
            const redeemId = randomBytes(8).toString("hex");
            const redeemSecret = randomBytes(15).toString("hex");
            return `${params.siteKey}:${redeemId}:${redeemSecret}`;
          },
          tokenTtlMs: TOKEN_TTL_MS,
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers,
          },
          verifyWebBotAuth: true,
          webBotAuthNonceCheck: async (nonce, ttlMs) => {
            const claim = await db.send("SET", [
              `wbanonce:${createHash("sha256").update(nonce).digest("hex")}`,
              "1",
              "NX",
              "EX",
              String(Math.max(1, Math.ceil(ttlMs / 1000))),
            ]);
            return claim === "OK";
          },
          behaviorReplayCheck: async (digest, ttlMs) => {
            const claim = await db.send("SET", [
              `bhtrace:${params.siteKey}:${digest}`,
              "1",
              "NX",
              "EX",
              String(Math.max(60, Math.ceil(ttlMs / 1000))),
            ]);
            return claim !== "OK";
          },
        },
      );

      const behavior = result.behavior;
      const agent = behavior?.agent ?? result.agent;
      const base = {
        ...contextFields(ctx),
        site_key: params.siteKey,
        type: "redeem",
        protocol: (() => {
          try {
            const claims = JSON.parse(
              Buffer.from(body.token.split(".")[1], "base64url").toString(),
            );
            if (claims.x?.pf === "sha256-pow") return "sha256-pow";
          } catch {}
          return resolveProtocol(keyConfig);
        })(),
        solve_ms: result.iat ? Date.now() - result.iat : null,
        score: behavior?.score ?? null,
        verdict: behavior?.verdict ?? "",
        agent: agent?.detected ? agent.name : "",
        agent_confidence: agent?.detected ? agent.confidence : "",
        agent_verified: agent?.verified ? 1 : 0,
      };

      const deny = (status, response, reason, extra = {}) => {
        set.status = status;
        recordEvent({
          ...base,
          outcome:
            blockedReasons.has(reason) || extra.outcome === "block"
              ? "block"
              : "fail",
          reason: reason || "failed",
          flags: result.riskFlags ?? behavior?.flags ?? [],
          ...extra,
        });
        return response;
      };

      if (!result.success) {
        const reason = result.reason;
        if (
          reason === "missing_token" ||
          reason === "missing_solutions" ||
          reason === "invalid_solutions"
        ) {
          return deny(400, { error: "Invalid solutions" }, reason);
        }
        if (reason === "expired")
          return deny(403, { error: "Challenge expired" }, reason);
        if (reason === "scope_mismatch") {
          return deny(
            403,
            { error: "Challenge token does not match site key" },
            reason,
          );
        }
        if (reason === "invalid_token")
          return deny(403, { error: "Invalid challenge token" }, reason);
        if (reason === "already_redeemed")
          return deny(403, { error: "Challenge already redeemed" }, reason);
        if (reason === "invalid_solution")
          return deny(403, { error: "Invalid solution" }, reason);
        if (reason?.startsWith("behavior_")) {
          return deny(
            403,
            { error: "Blocked by interaction checks", reason },
            reason,
          );
        }
        if (result.instr_error) {
          const mapped = {
            instr_corrupted: "corrupted_instrumentation_data",
            instr_expired: "expired",
            instr_automated_browser: "automated_browser_detected",
            instr_automated_interaction: "automated_interaction_detected",
            instr_missing: "missing_instrumentation_response",
          }[reason];
          if (reason === "instr_timeout") {
            return deny(
              429,
              {
                instr_error: true,
                error: "Instrumentation timeout",
                reason: "timeout",
              },
              reason,
            );
          }
          return deny(
            403,
            {
              instr_error: true,
              error: "Blocked by instrumentation",
              reason: mapped || reason || "failed_challenge",
            },
            reason,
            result.blockedBy ? { flags: [result.blockedBy].flat() } : {},
          );
        }
        return deny(
          403,
          { error: result.error || "Validation failed", reason },
          reason,
        );
      }

      ctx.score = behavior?.score;
      ctx.verdict = behavior?.verdict;
      ctx.agent = base.agent;
      ctx.agent_confidence = base.agent_confidence;
      ctx.agent_verified = !!agent?.verified;
      ctx.flags = result.riskFlags ?? [];
      ctx.solve_ms = base.solve_ms;

      let decision = { action: null, flags: [], matched: [] };
      try {
        const rules = await getRules(params.siteKey);
        if (rules.needsVelocity && ctx.ip) {
          try {
            Object.assign(ctx, await velocity(params.siteKey, ctx, false));
          } catch {}
        }
        decision = await evaluateRules(rules, ctx, "redeem");
      } catch (e) {
        console.error("[cap] rule evaluation failed:", e);
      }

      const policy = applySignalPolicy(keyConfig, result);
      const flags = [...policy.flags, ...decision.flags];

      if (decision.action === "block") {
        return deny(
          403,
          { error: "Blocked", reason: "rule" },
          `rule:${decision.rule.id}`,
          {
            outcome: "block",
            rule: decision.rule.id,
            flags,
          },
        );
      }
      if (decision.action !== "allow") {
        const agentChecks =
          keyConfig.blockAgents === "all" ||
          keyConfig.blockAgents === "identified";
        if (agentChecks && result.riskFlags?.includes("host_unreachable")) {
          return deny(
            403,
            {
              instr_error: true,
              error: "Blocked by instrumentation",
              reason: "instr_host_unreachable",
            },
            "instr_host_unreachable",
            { outcome: "block", flags },
          );
        }
        if (policy.agentBlocked) {
          return deny(
            403,
            {
              error: "Blocked by interaction checks",
              reason: "behavior_agent",
            },
            "behavior_agent",
            {
              flags,
            },
          );
        }
        if (policy.blockedBy) {
          return deny(
            403,
            { error: "Blocked", reason: "signal" },
            `signal:${policy.blockedBy}`,
            {
              outcome: "block",
              flags,
            },
          );
        }
      }

      const redeemToken = result.token;
      const tokenExpires = result.expires;
      const tokenTtlSecs = Math.ceil(TOKEN_TTL_MS / 1000);
      const ruleId =
        decision.action === "allow"
          ? decision.rule.id
          : (decision.matched[0] ?? "");
      const record =
        behavior || flags.length || agent?.detected || decision.matched.length
          ? JSON.stringify({
              e: tokenExpires,
              f: flags,
              ...(behavior && { s: behavior.score, v: behavior.verdict }),
              ...(agent?.detected && {
                a: {
                  name: agent.name,
                  confidence: agent.confidence,
                  verified: agent.verified,
                },
              }),
              ...(decision.matched.length && { r: decision.matched }),
            })
          : String(tokenExpires);
      await db.send("SET", [
        `token:${redeemToken}`,
        record,
        "EX",
        String(tokenTtlSecs),
      ]);

      recordEvent({
        ...base,
        outcome: "pass",
        reason:
          decision.action === "allow" ? `allowed:${decision.rule.id}` : "",
        flags,
        rule: ruleId,
        token_id: redeemToken.split(":")[1],
      });

      return {
        success: true,
        token: redeemToken,
        expires: tokenExpires,
      };
    },
    {
      parse: async ({ request }) => {
        const reader = request.body?.getReader();
        if (!reader) return {};
        const chunks = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_REDEEM_BYTES) {
            reader.cancel().catch(() => {});
            return TOO_LARGE;
          }
          chunks.push(value);
        }
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          return {};
        }
      },
    },
  );
