import { randomBytes } from "node:crypto";
import { db, hgetall } from "#db";
import { unmapIpv4 } from "./address.js";
import { ipInCidr, isIp, parseCidr } from "./ip.js";

export const ENTRY_KINDS = [
  "ip",
  "cidr",
  "asn",
  "org",
  "country",
  "ua",
  "visitor",
];

const MAX_ITEMS = 100_000;
const CACHE_TTL = 5_000;
const cache = new Map();

export function normalizeEntry(kind, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value || value.length > 256) return null;
  if (kind === "ip") {
    const ip = unmapIpv4(value).toLowerCase();
    return isIp(ip) ? `ip:${ip}` : null;
  }
  if (kind === "cidr")
    return parseCidr(value) ? `cidr:${value.toLowerCase()}` : null;
  if (kind === "asn") {
    const n = Number(value.replace(/^AS/i, ""));
    return Number.isInteger(n) && n > 0 ? `asn:${n}` : null;
  }
  if (kind === "org") return `org:${value.toLowerCase()}`;
  if (kind === "country")
    return /^[A-Za-z]{2}$/.test(value)
      ? `country:${value.toUpperCase()}`
      : null;
  if (kind === "ua") return `ua:${value}`;
  if (kind === "visitor")
    return /^[0-9a-f]{16}$/.test(value) ? `visitor:${value}` : null;
  return null;
}

export function splitEntry(entry) {
  const i = entry.indexOf(":");
  return { kind: entry.slice(0, i), value: entry.slice(i + 1) };
}

const parseMeta = (raw) => {
  if (raw === "0") return { e: 0 };
  if (/^\d+$/.test(raw)) return { e: Number(raw) };
  try {
    return JSON.parse(raw);
  } catch {
    return { e: 0 };
  }
};

export async function listLists() {
  const ids = await db.smembers("lists");
  const lists = await Promise.all(
    ids.map(async (id) => {
      const [meta, count] = await Promise.all([
        hgetall(`list:${id}`),
        db.send("HLEN", [`list:${id}:items`]),
      ]);
      if (!meta?.name) return null;
      return {
        id,
        name: meta.name,
        description: meta.description || "",
        created: Number(meta.created) || 0,
        count: Number(count) || 0,
      };
    }),
  );
  return lists.filter(Boolean).sort((a, b) => b.created - a.created);
}

export async function getList(id) {
  const meta = await hgetall(`list:${id}`);
  if (!meta?.name) return null;
  const raw = await hgetall(`list:${id}:items`);
  const now = Date.now();
  const items = [];
  const expired = [];
  for (const [entry, value] of Object.entries(raw)) {
    const m = parseMeta(value);
    if (m.e && m.e <= now) {
      expired.push(entry);
      continue;
    }
    items.push({
      ...splitEntry(entry),
      expires: m.e || null,
      note: m.n || "",
      added: m.a || null,
    });
  }
  if (expired.length)
    db.send("HDEL", [`list:${id}:items`, ...expired]).catch(() => {});
  items.sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
  return {
    id,
    name: meta.name,
    description: meta.description || "",
    created: Number(meta.created) || 0,
    items,
  };
}

export async function createList({ name, description = "", id: wanted }) {
  const id = wanted || `l_${randomBytes(5).toString("hex")}`;
  await db.hmset(`list:${id}`, [
    "name",
    name,
    "description",
    description,
    "created",
    String(Date.now()),
  ]);
  await db.sadd("lists", id);
  return id;
}

export async function updateList(id, { name, description }) {
  if (!(await db.exists(`list:${id}`))) return false;
  const fields = [];
  if (name != null) fields.push("name", name);
  if (description != null) fields.push("description", description);
  if (fields.length) await db.hmset(`list:${id}`, fields);
  return true;
}

export async function deleteList(id) {
  await Promise.all([
    db.del(`list:${id}`),
    db.del(`list:${id}:items`),
    db.srem("lists", id),
  ]);
  cache.delete(id);
}

export async function addItems(id, items) {
  if (!(await db.exists(`list:${id}`)))
    return { success: false, error: "List not found" };
  const size = Number(await db.send("HLEN", [`list:${id}:items`])) || 0;
  const args = [];
  const rejected = [];
  for (const item of items) {
    const entry = normalizeEntry(item.kind, item.value);
    if (!entry) {
      rejected.push(item.value);
      continue;
    }
    const e = item.ttl ? Date.now() + item.ttl * 1000 : 0;
    args.push(
      entry,
      JSON.stringify({
        e,
        a: Date.now(),
        ...(item.note && { n: String(item.note).slice(0, 200) }),
      }),
    );
  }
  if (size + args.length / 2 > MAX_ITEMS) {
    return { success: false, error: `Lists hold at most ${MAX_ITEMS} entries` };
  }
  if (args.length) await db.send("HSET", [`list:${id}:items`, ...args]);
  cache.delete(id);
  return { success: true, added: args.length / 2, rejected };
}

export async function removeItems(id, items) {
  const entries = items
    .map((i) => normalizeEntry(i.kind, i.value))
    .filter(Boolean);
  if (entries.length) await db.send("HDEL", [`list:${id}:items`, ...entries]);
  cache.delete(id);
  return { success: true, removed: entries.length };
}

async function compile(id) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.m;
  const raw = await hgetall(`list:${id}:items`);
  const m = {
    ips: new Map(),
    cidrs: [],
    asns: new Map(),
    orgs: new Map(),
    countries: new Map(),
    uas: [],
    visitors: new Map(),
  };
  for (const [entry, value] of Object.entries(raw)) {
    const { e } = parseMeta(value);
    const { kind, value: v } = splitEntry(entry);
    if (kind === "ip") m.ips.set(v, e);
    else if (kind === "cidr") m.cidrs.push([parseCidr(v), e, v]);
    else if (kind === "asn") m.asns.set(Number(v), e);
    else if (kind === "org") m.orgs.set(v, e);
    else if (kind === "country") m.countries.set(v, e);
    else if (kind === "ua") m.uas.push([v.toLowerCase(), e, v]);
    else if (kind === "visitor") m.visitors.set(v, e);
  }
  cache.set(id, { m, ts: Date.now() });
  return m;
}

export async function matchList(id, ctx) {
  const m = await compile(id);
  const now = Date.now();
  const live = (e) => !e || e > now;
  const ip = ctx.ip ? unmapIpv4(ctx.ip).toLowerCase() : ctx.ip;
  if (ip && m.ips.has(ip) && live(m.ips.get(ip))) return `ip:${ip}`;
  for (const [parsed, e, raw] of m.cidrs) {
    if (live(e) && ipInCidr(ip, parsed)) return `cidr:${raw}`;
  }
  if (ctx.asn && m.asns.has(ctx.asn) && live(m.asns.get(ctx.asn)))
    return `asn:${ctx.asn}`;
  const org = ctx.asn_org?.toLowerCase();
  if (org && m.orgs.has(org) && live(m.orgs.get(org))) return `org:${org}`;
  if (
    ctx.country &&
    m.countries.has(ctx.country) &&
    live(m.countries.get(ctx.country))
  ) {
    return `country:${ctx.country}`;
  }
  if (ctx.ua && m.uas.length) {
    const ua = ctx.ua.toLowerCase();
    for (const [needle, e, raw] of m.uas)
      if (live(e) && ua.includes(needle)) return `ua:${raw}`;
  }
  if (ctx.fp && m.visitors.has(ctx.fp) && live(m.visitors.get(ctx.fp)))
    return `visitor:${ctx.fp}`;
  return null;
}

export const keyBlocklistId = (siteKey) => `blk_${siteKey}`;

export async function ensureKeyBlocklist(siteKey) {
  const id = keyBlocklistId(siteKey);
  if (await db.exists(`list:${id}`)) return id;
  const name = (await db.hget(`key:${siteKey}`, "name")) || siteKey;
  await createList({
    id,
    name: `Blocked on ${name}`,
    description: "Created from this key's IP blocking rules",
  });
  return id;
}

export function legacyEntry(type, value) {
  if (type === "asn" && !/^(AS)?\d+$/i.test(value)) return ["org", value];
  return [type || "ip", value];
}
