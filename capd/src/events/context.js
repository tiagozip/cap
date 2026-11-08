import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { isLoaded as ipdbIsLoaded, lookup as ipLookup } from "#ipdb";
import { socketIp as platformSocketIp, requestGeo } from "#platform";
import { dottedToHex, isPrivateAddress, unmapIpv4 } from "../policy/address.js";
import { ipv6ToBytes } from "../policy/ip.js";
import { getHeaders } from "../settings-cache.js";

const FORWARDING_HEADERS = ["X-Forwarded-For", "X-Real-IP", "CF-Connecting-IP"];
let warnedForwarding = false;

const warnForwarding = (request, socketIp) => {
  if (warnedForwarding || !socketIp || !isPrivateAddress(socketIp)) return;
  if (!FORWARDING_HEADERS.some((h) => request.headers.has(h))) return;
  warnedForwarding = true;
  console.warn(
    `[cap] A request from ${socketIp} carried a forwarding header, so Cap is probably behind a proxy. Until you pick your proxy under Settings > Visitor location > Your proxy or CDN, every visitor is rate limited as the proxy's IP.`,
  );
};

export function getClientIp(request, srv) {
  const configured = getHeaders()?.ipHeader;
  const forwarded = configured
    ? request.headers
        .get(configured)
        ?.split(",")
        .map((e) => e.trim())
        .filter(Boolean)
        .at(-1)
    : null;
  if (forwarded && isIP(forwarded)) return unmapIpv4(forwarded);
  const socketIp = platformSocketIp(request, srv);
  if (!configured) warnForwarding(request, socketIp);
  return socketIp ? unmapIpv4(socketIp) : null;
}

export function parseUA(ua) {
  if (!ua) return { platform: null, os: null, browser: null };

  let os = null;
  if (/iPad/.test(ua)) os = "iPadOS";
  else if (/iPhone/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";

  let platform = null;
  if (/iPhone|Android.*Mobile|Mobile.*Android/.test(ua)) platform = "Phone";
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) platform = "Tablet";
  else if (/Macintosh|Windows|Linux|CrOS/.test(ua)) platform = "Desktop";

  let browser = null;
  if (/HeadlessChrome/.test(ua)) browser = "HeadlessChrome";
  else if (/\bEdg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/\bOPR\/|\bOpera\b/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/\bFirefox\/|\bFxiOS\//.test(ua)) browser = "Firefox";
  else if (/\bChrome\/|\bCriOS\//.test(ua)) browser = "Chrome";
  else if (/\bVersion\/[\d.]+.*Safari\//.test(ua)) browser = "Safari";
  else if (/^Mozilla\//.test(ua)) browser = "Other";
  else browser = "Non-browser";

  return { platform, os, browser };
}

export function maskIp(ip, mode) {
  if (!ip || mode === "full") return ip || "";
  if (mode === "none") return "";
  const addr = unmapIpv4(ip);
  const family = isIP(addr);
  if (family === 4) return addr.split(".").slice(0, 3).concat("0").join(".");
  if (family !== 6) return "";
  const bytes = ipv6ToBytes(dottedToHex(addr.split("%")[0]));
  const groups = [0, 2, 4].map((i) =>
    ((bytes[i] << 8) | bytes[i + 1]).toString(16),
  );
  return `${groups.join(":")}::`;
}

const asnNumber = (asn) => {
  const n = Number(String(asn ?? "").replace(/^AS/i, ""));
  return Number.isFinite(n) && n >= 0 && n <= 4294967295 ? Math.trunc(n) : 0;
};

let salt = null;
export function setVisitorSalt(value) {
  salt = value;
}

export async function requestContext(request, srv) {
  const ip = getClientIp(request, srv) || "";
  const ua = request.headers.get("user-agent") || "";
  const hs = getHeaders() || {};
  let country = hs.countryHeader ? request.headers.get(hs.countryHeader) : null;
  let asnRaw = hs.asnHeader ? request.headers.get(hs.asnHeader) : null;
  let asnOrg = null;
  const geo = requestGeo(request);
  if (geo) {
    if (!country && geo.country) country = geo.country;
    if (!asnRaw && geo.asn) {
      asnRaw = geo.asn;
      asnOrg = geo.org;
    }
  }

  if (ip && (!country || !asnRaw) && ipdbIsLoaded()) {
    try {
      const geo = await ipLookup(ip);
      if (!country && geo?.country) country = geo.country;
      if (!asnRaw && geo?.asn) {
        asnRaw = geo.asn;
        asnOrg = geo.org || null;
      }
    } catch {}
  }

  let origin = "";
  const originHeader =
    request.headers.get("origin") || request.headers.get("referer");
  if (originHeader) {
    try {
      origin = new URL(originHeader).host;
    } catch {}
  }

  const lang = (request.headers.get("accept-language") || "")
    .split(",")[0]
    .split(";")[0]
    .trim()
    .slice(0, 16);

  const fp = createHash("sha256")
    .update(`${salt ?? ""}|${ip}|${ua}|${lang}`)
    .digest("hex")
    .slice(0, 16);

  return {
    ip,
    ua,
    country: country ? String(country).toUpperCase().slice(0, 2) : "",
    asn: asnNumber(asnRaw),
    asn_org:
      asnOrg || (asnNumber(asnRaw) ? `AS${asnNumber(asnRaw)}` : asnRaw || ""),
    origin,
    lang,
    fp,
    headers: request.headers,
    ...parseUA(ua),
  };
}
