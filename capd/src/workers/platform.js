import { env, waitUntil } from "cloudflare:workers";
import { randomBytes } from "node:crypto";

export const runtime = "cloudflare-workers";
export const runtimeVersion = () =>
  `workerd ${env.CF_VERSION_METADATA?.id ?? ""}`.trim();

export function uuidv7() {
  const bytes = randomBytes(16);
  const ts = Date.now();
  for (let i = 0; i < 6; i++)
    bytes[i] = Math.floor(ts / 2 ** (8 * (5 - i))) % 256;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const defer = (promise) =>
  waitUntil(Promise.resolve(promise).catch(() => {}));
export const every = () => {};
export const later = (fn, ms) => defer(sleep(ms).then(fn));
export const socketIp = (request) =>
  request.headers.get("cf-connecting-ip") || null;

export function requestGeo(request) {
  const cf = request.cf ?? {};
  return {
    country: typeof cf.country === "string" ? cf.country : null,
    asn: cf.asn ? `AS${cf.asn}` : null,
    org: typeof cf.asOrganization === "string" ? cf.asOrganization : null,
  };
}

export const resolveHost = async () => null;
export const bufferEvents = false;
