import { RE2JS } from "re2js";
import { db, hgetall } from "#db";
import { ipInCidr, parseCidr } from "./ip.js";
import {
  addItems,
  ensureKeyBlocklist,
  keyBlocklistId,
  legacyEntry,
  matchList,
} from "./lists.js";

export const RULE_FIELDS = {
  ip: { type: "string", stage: "request", label: "IP address" },
  country: { type: "string", stage: "request", label: "Country" },
  asn: { type: "number", stage: "request", label: "ASN" },
  asn_org: { type: "string", stage: "request", label: "Network name" },
  ua: { type: "string", stage: "request", label: "User agent" },
  browser: { type: "string", stage: "request", label: "Browser" },
  os: { type: "string", stage: "request", label: "Operating system" },
  platform: { type: "string", stage: "request", label: "Device type" },
  origin: { type: "string", stage: "request", label: "Origin host" },
  lang: { type: "string", stage: "request", label: "Language" },
  visitor: { type: "string", stage: "request", label: "Visitor ID" },
  header: { type: "header", stage: "request", label: "Request header" },
  list: { type: "list", stage: "request", label: "List" },
  ip_velocity: {
    type: "number",
    stage: "request",
    label: "Challenges from this IP in the last minute",
  },
  visitor_velocity: {
    type: "number",
    stage: "request",
    label: "Challenges from this visitor in the last minute",
  },
  score: { type: "number", stage: "result", label: "Interaction score" },
  verdict: { type: "string", stage: "result", label: "Interaction verdict" },
  agent: { type: "string", stage: "result", label: "AI agent" },
  agent_confidence: {
    type: "string",
    stage: "result",
    label: "Agent confidence",
  },
  agent_verified: {
    type: "bool",
    stage: "result",
    label: "Agent signature verified",
  },
  flag: { type: "flag", stage: "result", label: "Risk flag" },
  solve_ms: { type: "number", stage: "result", label: "Solve time (ms)" },
};

export const OPS = {
  string: [
    "eq",
    "neq",
    "in",
    "not_in",
    "contains",
    "not_contains",
    "starts_with",
    "matches",
  ],
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  header: [
    "exists",
    "not_exists",
    "eq",
    "neq",
    "contains",
    "not_contains",
    "matches",
  ],
  list: ["in_list", "not_in_list"],
  flag: ["has", "not_has"],
  bool: ["is_true", "is_false"],
};

export const ACTIONS = ["block", "allow", "flag", "harder"];

const MAX_RULES = 100;
const MAX_CONDITIONS = 12;
const MAX_PATTERN_LENGTH = 200;
const MAX_REGEX_CONDITIONS = 10;
export const REGEX_INPUT_LIMIT = 512;
const MAX_PROGRAM_SIZE = 500;

const UNSUPPORTED =
  "Backreferences, lookaheads and lookbehinds aren't supported";

export function compileRegex(pattern) {
  if (pattern.length > MAX_PATTERN_LENGTH)
    return { error: `is longer than ${MAX_PATTERN_LENGTH} characters` };
  if (/(?:^|[^\\])(?:\\\\)*\\k</.test(pattern))
    return { error: `uses a backreference. ${UNSUPPORTED}` };
  let re;
  try {
    re = RE2JS.compile(RE2JS.translateRegExp(pattern), RE2JS.CASE_INSENSITIVE);
  } catch (e) {
    const reason = String(e?.message ?? "")
      .replace(/^error parsing regexp: /, "")
      .replaceAll("`(?i)", "`")
      .slice(0, 120);
    if (!reason) return { error: "isn't a valid regular expression" };
    return {
      error: /escape|Perl syntax|named capture/.test(reason)
        ? `can't be compiled, ${reason}. ${UNSUPPORTED}`
        : `can't be compiled, ${reason}`,
    };
  }
  const size = re.re2()?.prog?.inst?.length;
  if (!Number.isFinite(size) || size > MAX_PROGRAM_SIZE)
    return { error: "is too complex, use smaller repeat counts" };
  return { re };
}

export const unsafeRegex = (pattern) => compileRegex(pattern).error ?? null;

const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "rule";

export function validateRules(input) {
  if (!Array.isArray(input)) return { error: "Rules must be an array" };
  if (input.length > MAX_RULES)
    return { error: `At most ${MAX_RULES} rules per key` };
  const ids = new Set();
  const rules = [];
  let regexConditions = 0;
  for (const [i, r] of input.entries()) {
    const name = String(r?.name ?? "")
      .trim()
      .slice(0, 80);
    if (!name) return { error: `Rule ${i + 1} needs a name` };
    if (!ACTIONS.includes(r.action))
      return { error: `Rule "${name}" has an unknown action` };
    let id = r.id && /^[a-z0-9-]{1,48}$/.test(r.id) ? r.id : slug(name);
    for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`;
    ids.add(id);
    const conditions = Array.isArray(r.conditions) ? r.conditions : [];
    if (!conditions.length)
      return { error: `Rule "${name}" needs at least one condition` };
    if (conditions.length > MAX_CONDITIONS)
      return { error: `Rule "${name}" has too many conditions` };
    const clean = [];
    for (const c of conditions) {
      const spec = RULE_FIELDS[c?.field];
      if (!spec) return { error: `Rule "${name}" uses an unknown field` };
      if (!OPS[spec.type].includes(c.op))
        return {
          error: `Rule "${name}": "${c.op}" doesn't work with ${spec.label}`,
        };
      const cond = { field: c.field, op: c.op };
      if (spec.type === "header") {
        const header = String(c.header ?? "")
          .trim()
          .toLowerCase();
        if (!/^[a-z0-9-]{1,64}$/.test(header))
          return { error: `Rule "${name}" needs a header name` };
        cond.header = header;
      }
      if (!["exists", "not_exists", "is_true", "is_false"].includes(c.op)) {
        if (c.op === "in" || c.op === "not_in") {
          const values = (
            Array.isArray(c.value) ? c.value : String(c.value ?? "").split(",")
          )
            .map((v) => String(v).trim())
            .filter(Boolean)
            .slice(0, 500);
          if (!values.length)
            return { error: `Rule "${name}" has an empty value list` };
          cond.value = values;
        } else if (spec.type === "number") {
          const n = Number(c.value);
          if (!Number.isFinite(n))
            return { error: `Rule "${name}": ${spec.label} needs a number` };
          cond.value = n;
        } else {
          const v = String(c.value ?? "");
          if (!v) return { error: `Rule "${name}" has an empty value` };
          if (v.length > 300)
            return { error: `Rule "${name}" has a value over 300 characters` };
          if (c.op === "matches") {
            const { error: problem } = compileRegex(v);
            if (problem)
              return {
                error: `Rule "${name}": the regular expression ${problem}`,
              };
            regexConditions++;
            if (regexConditions > MAX_REGEX_CONDITIONS)
              return {
                error: `At most ${MAX_REGEX_CONDITIONS} regular expression conditions per key`,
              };
          }
          cond.value = v;
        }
      }
      clean.push(cond);
    }
    const factor = Math.min(10, Math.max(1.5, Number(r.factor) || 2));
    rules.push({
      id,
      name,
      enabled: r.enabled !== false,
      match: r.match === "any" ? "any" : "all",
      conditions: clean,
      action: r.action,
      ...(r.action === "harder" && { factor }),
      ...(r.note && { note: String(r.note).slice(0, 300) }),
    });
  }
  return { rules };
}

const cache = new Map();
const CACHE_TTL = 5_000;

export async function getRules(siteKey) {
  const hit = cache.get(siteKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.compiled;
  let rules = [];
  try {
    rules = JSON.parse((await db.get(`rules:${siteKey}`)) || "[]");
  } catch {}
  const compiled = rules.map((r) => ({
    ...r,
    requestOnly: r.conditions.every(
      (c) => RULE_FIELDS[c.field]?.stage === "request",
    ),
    conditions: r.conditions.map((c) => ({
      ...c,
      ...(c.op === "matches" && {
        re: compileRegex(String(c.value)).re ?? null,
      }),
      ...(c.field === "ip" &&
        Array.isArray(c.value) && {
          cidrs: c.value
            .filter((v) => v.includes("/"))
            .map(parseCidr)
            .filter(Boolean),
        }),
    })),
  }));
  compiled.needsVelocity = compiled.some(
    (r) => r.enabled && r.conditions.some((c) => c.field.endsWith("_velocity")),
  );
  cache.set(siteKey, { compiled, ts: Date.now() });
  return compiled;
}

export async function saveRules(siteKey, rules) {
  await db.set(`rules:${siteKey}`, JSON.stringify(rules));
  cache.delete(siteKey);
}

export function invalidateRules(siteKey) {
  cache.delete(siteKey);
}

const fieldValue = (c, ctx) => {
  if (c.field === "header") return ctx.headers?.get?.(c.header) ?? null;
  if (c.field === "visitor") return ctx.fp;
  if (c.field === "flag") return ctx.flags ?? [];
  return ctx[c.field];
};

async function test(c, ctx) {
  const v = fieldValue(c, ctx);
  switch (c.op) {
    case "exists":
      return v != null && v !== "";
    case "not_exists":
      return v == null || v === "";
    case "is_true":
      return v === true;
    case "is_false":
      return v !== true;
    case "in_list":
      return !!(await matchList(c.value, ctx));
    case "not_in_list":
      return !(await matchList(c.value, ctx));
    case "has":
    case "not_has": {
      const flags = v ?? [];
      const found = c.value.endsWith("*")
        ? flags.some((f) => f.startsWith(c.value.slice(0, -1)))
        : flags.includes(c.value);
      return c.op === "has" ? found : !found;
    }
  }
  if (v == null || v === "")
    return c.op === "neq" || c.op === "not_in" || c.op === "not_contains";
  if (RULE_FIELDS[c.field].type === "number") {
    const n = Number(v);
    if (c.op === "eq") return n === c.value;
    if (c.op === "neq") return n !== c.value;
    if (c.op === "gt") return n > c.value;
    if (c.op === "gte") return n >= c.value;
    if (c.op === "lt") return n < c.value;
    if (c.op === "lte") return n <= c.value;
    return false;
  }
  const s = String(v);
  const lower = s.toLowerCase();
  if (c.op === "eq") return lower === String(c.value).toLowerCase();
  if (c.op === "neq") return lower !== String(c.value).toLowerCase();
  if (c.op === "contains") return lower.includes(String(c.value).toLowerCase());
  if (c.op === "not_contains")
    return !lower.includes(String(c.value).toLowerCase());
  if (c.op === "starts_with")
    return lower.startsWith(String(c.value).toLowerCase());
  if (c.op === "matches")
    return c.re?.test(s.slice(0, REGEX_INPUT_LIMIT)) ?? false;
  if (c.op === "in" || c.op === "not_in") {
    const found =
      c.value.some((x) => x.toLowerCase() === lower) ||
      (c.cidrs?.length > 0 && c.cidrs.some((p) => ipInCidr(s, p)));
    return c.op === "in" ? found : !found;
  }
  return false;
}

export async function evaluateRules(rules, ctx, stage) {
  const out = { action: null, rule: null, flags: [], factor: 1, matched: [] };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (stage === "challenge" && !rule.requestOnly) continue;
    let hit = rule.match === "all";
    for (const c of rule.conditions) {
      const ok = await test(c, ctx);
      if (rule.match === "all" && !ok) {
        hit = false;
        break;
      }
      if (rule.match === "any" && ok) {
        hit = true;
        break;
      }
    }
    if (!hit) continue;
    out.matched.push(rule.id);
    if (rule.action === "flag") {
      out.flags.push(`rule:${rule.id}`);
      continue;
    }
    if (rule.action === "harder") {
      out.factor = Math.max(out.factor, rule.factor || 2);
      continue;
    }
    out.action = rule.action;
    out.rule = rule;
    break;
  }
  return out;
}

export async function migrateLegacyBlocks() {
  const siteKeys = await db.smembers("keys");
  for (const sk of siteKeys) {
    const raw = await hgetall(`blocked:${sk}`);
    const entries = Object.entries(raw);
    if (!entries.length) continue;
    const listId = await ensureKeyBlocklist(sk);
    const now = Date.now();
    const items = [];
    const expired = [];
    for (const [key, val] of entries) {
      const ttl = val === "0" ? 0 : Math.ceil((Number(val) - now) / 1000);
      if (val !== "0" && ttl <= 0) {
        expired.push(key);
        continue;
      }
      const i = key.indexOf(":");
      const [kind, value] =
        i > 0 && ["cidr", "asn", "country"].includes(key.slice(0, i))
          ? legacyEntry(key.slice(0, i), key.slice(i + 1))
          : legacyEntry("ip", key);
      items.push({ kind, value, ttl, key });
    }
    const res = items.length
      ? await addItems(listId, items)
      : { success: true, added: 0, rejected: [] };
    if (!res.success) {
      console.warn(
        `[cap] couldn't move the blocking rules for ${sk} into list ${listId}: ${res.error}. They stay in blocked:${sk}, so nothing was lost.`,
      );
      continue;
    }
    await ensureBlocklistRule(sk);
    const rejected = new Set(res.rejected);
    const kept = items.filter((item) => rejected.has(item.value));
    const moved = items.filter((item) => !rejected.has(item.value));
    const done = [...expired, ...moved.map((item) => item.key)];
    if (!kept.length) await db.del(`blocked:${sk}`);
    else if (done.length) await db.send("HDEL", [`blocked:${sk}`, ...done]);
    console.log(
      `[cap] moved ${moved.length} blocking rules for ${sk} into list ${listId}`,
    );
    if (kept.length)
      console.warn(
        `[cap] ${kept.length} blocking rules for ${sk} aren't valid list entries and stay in blocked:${sk}: ${kept
          .map((item) => item.key)
          .join(", ")}`,
      );
  }
}

export async function ensureBlocklistRule(siteKey) {
  const listId = keyBlocklistId(siteKey);
  let rules = [];
  try {
    rules = JSON.parse((await db.get(`rules:${siteKey}`)) || "[]");
  } catch {}
  if (
    rules.some((r) =>
      r.conditions?.some((c) => c.field === "list" && c.value === listId),
    )
  )
    return;
  rules.unshift({
    id: "blocklist",
    name: "Block entries on this key's blocklist",
    enabled: true,
    match: "all",
    conditions: [{ field: "list", op: "in_list", value: listId }],
    action: "block",
  });
  await saveRules(siteKey, rules);
}
