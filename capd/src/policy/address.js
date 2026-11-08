import { isIP } from "node:net";
import { resolveHost } from "#platform";
import { ipInCidr, ipv6ToBytes, parseCidr } from "./ip.js";

const PRIVATE_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4",
  "240.0.0.0/4",
].map(parseCidr);

const PRIVATE_V6 = ["::/127", "fc00::/7", "fe80::/10", "ff00::/8"].map(
  parseCidr,
);

const EMBEDS_V4 = ["::ffff:0:0/96", "::/96", "64:ff9b::/96"].map(parseCidr);

const bare = (ip) =>
  String(ip ?? "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]
    .toLowerCase();

export const dottedToHex = (ip) =>
  ip.replace(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/, (_, a, b, c, d) =>
    [
      ((Number(a) << 8) | Number(b)).toString(16),
      ((Number(c) << 8) | Number(d)).toString(16),
    ].join(":"),
  );

export function embeddedIpv4(raw) {
  const ip = bare(raw);
  if (isIP(ip) !== 6) return null;
  const v6 = dottedToHex(ip);
  if (!EMBEDS_V4.some((c) => ipInCidr(v6, c))) return null;
  return [...ipv6ToBytes(v6).slice(12)].join(".");
}

export function unmapIpv4(raw) {
  const ip = String(raw ?? "").trim();
  const m = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (m) return m[1];
  if (!/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i.test(ip)) return ip;
  return embeddedIpv4(ip) ?? ip;
}

export function isPrivateAddress(raw) {
  const ip = bare(raw);
  const family = isIP(ip);
  if (family === 4) return PRIVATE_V4.some((c) => ipInCidr(ip, c));
  if (family !== 6) return true;
  const v6 = dottedToHex(ip);
  if (PRIVATE_V6.some((c) => ipInCidr(v6, c))) return true;
  const v4 = embeddedIpv4(ip);
  return v4 ? isPrivateAddress(v4) : false;
}

export const isLocalHostname = (hostname) => {
  const host = bare(hostname).replace(/\.$/, "");
  if (isIP(host)) return isPrivateAddress(host);
  return host === "localhost" || host.endsWith(".localhost");
};

export async function resolvePublicAddress(hostname) {
  const host = bare(hostname);
  const family = isIP(host);
  const addresses = family
    ? [{ address: host, family }]
    : await resolveHost(host);
  if (addresses === null) return { address: host, family: 0, unresolved: true };
  if (!addresses.length) return null;
  if (addresses.some((a) => isPrivateAddress(a.address))) return null;
  return addresses[0];
}
