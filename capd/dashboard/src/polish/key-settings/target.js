import { countryNames } from "../../lib/geo.js";

const byName = new Map(
  Object.entries(countryNames).map(([code, name]) => [
    name.toLowerCase(),
    code,
  ]),
);

const compact = new Intl.NumberFormat(undefined, { notation: "compact" });

const v4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const v6 = /^[\da-f:]*:[\da-f:.]*$/i;

export const parseTarget = (raw) => {
  const text = raw.trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  const code =
    byName.get(text.toLowerCase()) ??
    (/^[A-Z]{2}$/.test(upper) && countryNames[upper] ? upper : null);
  if (code) return { type: "country", value: code, text };
  if (v4.test(text) || (v6.test(text) && !text.includes("/")))
    return { type: "ip", value: text, text };
  const [ip, prefix, extra] = text.split("/");
  if (prefix !== undefined && extra === undefined && /^\d{1,3}$/.test(prefix)) {
    const p = Number(prefix);
    const isV4 = v4.test(ip);
    const max = isV4 ? 32 : 128;
    if ((isV4 || v6.test(ip)) && p <= max) {
      const bits = max - p;
      return {
        type: "cidr",
        value: text,
        text,
        detail: isV4
          ? `${compact.format(2 ** bits)} ${bits ? "addresses" : "address"}`
          : `IPv6 /${p}`,
      };
    }
    return { type: "bad", value: text, text };
  }
  if (/^(AS)?\d{1,10}$/i.test(text))
    return { type: "asn", value: `AS${text.replace(/^AS/i, "")}`, text };
  if (/^[\p{L}\d][\p{L}\d .,&'-]{1,63}$/u.test(text) && !/^[\d.:]+$/.test(text))
    return {
      type: "asn",
      value: text,
      text,
      detail: "By name",
    };
  return { type: "bad", value: text, text };
};

export const parseTargets = (raw) => {
  const seen = new Set();
  return raw.split(/[\n,;]+/).flatMap((part) => {
    const t = parseTarget(part);
    if (!t || seen.has(`${t.type}:${t.value}`)) return [];
    seen.add(`${t.type}:${t.value}`);
    return [t];
  });
};
