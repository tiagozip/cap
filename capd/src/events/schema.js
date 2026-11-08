export const COLUMNS = [
  ["id", "string"],
  ["ts", "int"],
  ["site_key", "string"],
  ["type", "string"],
  ["outcome", "string"],
  ["reason", "string"],
  ["ip", "string"],
  ["country", "string"],
  ["asn", "int"],
  ["asn_org", "string"],
  ["ua", "string"],
  ["browser", "string"],
  ["os", "string"],
  ["platform", "string"],
  ["origin", "string"],
  ["lang", "string"],
  ["fp", "string"],
  ["protocol", "string"],
  ["solve_ms", "nint"],
  ["score", "nfloat"],
  ["verdict", "string"],
  ["agent", "string"],
  ["agent_confidence", "string"],
  ["agent_verified", "int"],
  ["flags", "array"],
  ["rule", "string"],
  ["token_id", "string"],
];

export const COLUMN_NAMES = COLUMNS.map(([name]) => name);

export const EVENT_TYPES = ["challenge", "redeem", "siteverify"];
export const OUTCOMES = ["pass", "fail", "block", "limit"];

export const FILTER_FIELDS = new Set([
  "type",
  "outcome",
  "reason",
  "ip",
  "country",
  "asn",
  "asn_org",
  "browser",
  "os",
  "platform",
  "origin",
  "lang",
  "fp",
  "protocol",
  "verdict",
  "agent",
  "agent_confidence",
  "rule",
  "token_id",
  "flag",
]);

export const TOP_DIMENSIONS = new Set([
  "country",
  "asn",
  "asn_org",
  "ip",
  "browser",
  "os",
  "platform",
  "origin",
  "lang",
  "reason",
  "verdict",
  "agent",
  "rule",
  "fp",
  "flag",
]);

const MAX_LEN = {
  ua: 512,
  reason: 64,
  origin: 255,
  asn_org: 128,
  rule: 64,
};

export function normalizeEvent(raw) {
  const event = {};
  for (const [name, kind] of COLUMNS) {
    const value = raw[name];
    if (kind === "string") {
      const s = value == null ? "" : String(value);
      event[name] = s.slice(0, MAX_LEN[name] ?? 96);
    } else if (kind === "int") {
      const n = Math.trunc(Number(value));
      event[name] = Number.isFinite(n) ? n : 0;
    } else if (kind === "nint") {
      const n = Math.trunc(Number(value));
      event[name] =
        value == null || !Number.isFinite(n) ? null : Math.max(0, n);
    } else if (kind === "nfloat") {
      const n = Number(value);
      event[name] = value == null || !Number.isFinite(n) ? null : n;
    } else {
      event[name] = Array.isArray(value)
        ? [...new Set(value.map(String))].slice(0, 32)
        : [];
    }
  }
  return event;
}

export function presentEvent(row) {
  const out = {};
  for (const [name, kind] of COLUMNS) {
    const value = row[name];
    if (kind === "array") {
      out[name] = Array.isArray(value)
        ? value
        : typeof value === "string"
          ? JSON.parse(value || "[]")
          : [];
    } else if (kind === "string") {
      out[name] = value === "" || value == null ? null : value;
    } else if (kind === "int") {
      out[name] = Number(value) || 0;
    } else {
      out[name] = value == null ? null : Number(value);
    }
  }
  out.agent_verified = out.agent_verified === 1;
  out.asn = out.asn || null;
  return out;
}
