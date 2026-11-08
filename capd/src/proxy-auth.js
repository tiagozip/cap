import { randomBytes } from "node:crypto";
import { db } from "#db";
import { sameHex, tokenId } from "./secret-hash.js";

const KEY = "settings:proxy-auth";
const TTL_MS = 5_000;
export const PROXY_MODES = ["off", "allow", "require"];
export const DEFAULT_PROXY_HEADER = "X-Cap-Proxy-Secret";

const RESERVED = new Set([
  "authorization",
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "forwarded",
  "host",
  "origin",
  "referer",
  "transfer-encoding",
  "upgrade",
  "user-agent",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-real-ip",
]);

let cached = null;
let cachedAt = 0;

const defaults = () => ({
  mode: "off",
  header: DEFAULT_PROXY_HEADER,
  secretHash: null,
});

export const validProxyHeader = (name) =>
  typeof name === "string" &&
  /^[A-Za-z0-9-]{1,64}$/.test(name) &&
  !RESERVED.has(name.toLowerCase());

export async function proxyAuthSettings() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  let value = defaults();
  try {
    const raw = await db.get(KEY);
    if (raw) value = { ...value, ...JSON.parse(raw) };
  } catch {}
  if (!PROXY_MODES.includes(value.mode) || !value.secretHash)
    value.mode = "off";
  cached = value;
  cachedAt = Date.now();
  return value;
}

async function store(value) {
  await db.set(KEY, JSON.stringify(value));
  cached = value;
  cachedAt = Date.now();
}

export function headerMatches(request, header, secretHash) {
  const sent = request.headers.get(header);
  return !!sent && !!secretHash && sameHex(tokenId(sent), secretHash);
}

export async function proxyAuthPasses(request) {
  const { mode, header, secretHash } = await proxyAuthSettings();
  return mode !== "off" && headerMatches(request, header, secretHash);
}

export async function saveProxyAuth({ mode, header }) {
  const current = await proxyAuthSettings();
  await store({ ...current, mode, header });
}

export async function rotateProxySecret() {
  const secret = `cps_${randomBytes(32).toString("base64url")}`;
  const current = await proxyAuthSettings();
  await store({ ...current, secretHash: tokenId(secret) });
  return secret;
}

export const resetProxyAuthCache = () => {
  cached = null;
};
