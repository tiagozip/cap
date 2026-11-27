export const KIND_LABELS = {
  ip: "IP",
  cidr: "IP range",
  asn: "ASN",
  org: "Network name",
  country: "Country",
  ua: "User agent",
  visitor: "Visitor",
};

export const COUNT_LABELS = {
  ip: ["IP", "IPs"],
  cidr: ["IP range", "IP ranges"],
  asn: ["ASN", "ASNs"],
  org: ["network name", "network names"],
  country: ["country", "countries"],
  ua: ["user agent", "user agents"],
  visitor: ["visitor", "visitors"],
};

export const KIND_ORDER = [
  "ip",
  "cidr",
  "asn",
  "org",
  "country",
  "ua",
  "visitor",
];

const regions = new Intl.DisplayNames(["en"], { type: "region" });

export const countryName = (code) => {
  try {
    const name = regions.of(code);
    return name && name !== code ? name : "";
  } catch {
    return "";
  }
};

const isV4 = (v) => {
  const parts = v.split(".");
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)
  );
};

const isV6 = (v) => {
  if (!v.includes(":") || !/^[0-9a-f:.]+$/i.test(v)) return false;
  try {
    new URL(`http://[${v}]/`);
    return true;
  } catch {
    return false;
  }
};

const unmap = (v) => v.replace(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i, "$1");

function check(kind, raw) {
  const v = raw.trim();
  if (!v) return { error: "Empty value" };
  if (v.length > 256) return { error: "Longer than 256 characters" };
  if (kind === "ip") {
    const ip = unmap(v).toLowerCase();
    return isV4(ip) || isV6(ip) ? { value: ip } : { error: "Not a valid IP" };
  }
  if (kind === "cidr") {
    const [base, bits, extra] = v.split("/");
    if (extra !== undefined || !/^\d{1,3}$/.test(bits ?? ""))
      return { error: "Not a valid IP range" };
    const n = Number(bits);
    if (isV4(base))
      return n <= 32
        ? { value: v.toLowerCase() }
        : { error: "IPv4 ranges end at /32" };
    if (isV6(base))
      return n <= 128
        ? { value: v.toLowerCase() }
        : { error: "IPv6 ranges end at /128" };
    return { error: "Not a valid IP range" };
  }
  if (kind === "asn") {
    const n = Number(v.replace(/^AS/i, ""));
    return Number.isInteger(n) && n > 0 && n < 2 ** 32
      ? { value: String(n) }
      : { error: "Not a valid ASN" };
  }
  if (kind === "org") return { value: v.toLowerCase() };
  if (kind === "country") {
    if (!/^[A-Za-z]{2}$/.test(v)) return { error: "Use a two-letter code" };
    const code = v.toUpperCase();
    return countryName(code)
      ? { value: code }
      : { value: code, warning: "Unknown country code" };
  }
  if (kind === "ua") return { value: v };
  if (kind === "visitor")
    return /^[0-9a-f]{16}$/.test(v)
      ? { value: v }
      : { error: "Visitor IDs are 16 hex characters" };
  return { error: "Unknown type" };
}

function guess(v) {
  const m = v.match(/^(ip|cidr|asn|org|country|ua|visitor):(.+)$/i);
  if (m) return [m[1].toLowerCase(), m[2]];
  if (/^[0-9a-f:.]+\/\d+$/i.test(v)) return ["cidr", v];
  if (/^[\d.]+$/.test(v) && v.includes(".")) return ["ip", v];
  if (/^[0-9a-f:.]+$/i.test(v) && v.split(":").length > 2) return ["ip", v];
  if (/^(AS)?\d+$/i.test(v)) return ["asn", v];
  if (/^[A-Za-z]{2}$/.test(v)) return ["country", v];
  if (/^[0-9a-f]{16}$/.test(v)) return ["visitor", v];
  return ["ua", v];
}

const splitLine = (line) => {
  if (!line.includes(",")) return [line];
  const parts = line.split(",").map((s) => s.trim());
  return parts.every((p) => !/\s/.test(p)) ? parts : [line];
};

export const keyOf = (i) => `${i.kind}:${i.value}`;

export function parseEntries(text, existing) {
  const out = [];
  const seen = new Set();
  const lines = text.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const hash = lines[n].indexOf(" #");
    const body = (
      lines[n].trimStart().startsWith("#")
        ? ""
        : hash >= 0
          ? lines[n].slice(0, hash)
          : lines[n]
    ).trim();
    const note =
      hash >= 0
        ? lines[n]
            .slice(hash + 2)
            .trim()
            .slice(0, 200)
        : "";
    if (!body) continue;
    for (const raw of splitLine(body)) {
      if (!raw) continue;
      const [kind, value] = guess(raw);
      const res = check(kind, value);
      const entry = {
        line: n + 1,
        raw,
        kind,
        value: res.value ?? value.trim(),
        note,
      };
      if (res.error) {
        out.push({ ...entry, status: "invalid", reason: res.error });
        continue;
      }
      const k = keyOf(entry);
      if (seen.has(k)) {
        out.push({ ...entry, status: "duplicate", reason: "Pasted twice" });
        continue;
      }
      seen.add(k);
      if (existing?.has(k)) {
        out.push({
          ...entry,
          status: "existing",
          reason: "Already on this list",
        });
        continue;
      }
      out.push({ ...entry, status: "new", reason: res.warning ?? "" });
    }
  }
  return out;
}

export function stripLines(text, bad) {
  const lines = new Set(bad.map((e) => e.line));
  const raws = new Map();
  for (const e of bad) raws.set(e.line, [...(raws.get(e.line) ?? []), e.raw]);
  return text
    .split("\n")
    .flatMap((l, i) => {
      if (!lines.has(i + 1)) return [l];
      const parts = splitLine(l.split(" #")[0].trim());
      if (parts.length < 2) return [];
      const drop = raws.get(i + 1);
      const keep = parts.filter((p) => {
        const at = drop.indexOf(p);
        if (at < 0) return true;
        drop.splice(at, 1);
        return false;
      });
      return keep.length ? [keep.join(", ")] : [];
    })
    .join("\n");
}

const toBig = (ip) => {
  if (isV4(ip))
    return [4, ip.split(".").reduce((a, p) => (a << 8n) | BigInt(p), 0n)];
  if (!isV6(ip)) return null;
  let host = ip.toLowerCase();
  const tail = host.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail[1].split(".").map(Number);
    host = host.replace(
      tail[1],
      `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`,
    );
  }
  const [head, rest = ""] = host.split("::");
  const h = head ? head.split(":") : [];
  const r = rest ? rest.split(":") : [];
  const groups = host.includes("::")
    ? [...h, ...Array(8 - h.length - r.length).fill("0"), ...r]
    : h;
  if (groups.length !== 8) return null;
  return [6, groups.reduce((a, g) => (a << 16n) | BigInt(`0x${g || 0}`), 0n)];
};

export function ipProbe(q) {
  const ip = unmap(q.trim()).toLowerCase();
  const big = toBig(ip);
  if (!big) return null;
  return (item) => {
    if (item.kind === "ip") {
      const other = toBig(item.value);
      return !!other && other[0] === big[0] && other[1] === big[1];
    }
    if (item.kind !== "cidr") return false;
    const [base, bits] = item.value.split("/");
    const net = toBig(base);
    if (!net || net[0] !== big[0]) return false;
    const width = big[0] === 4 ? 32n : 128n;
    const shift = width - BigInt(bits);
    return net[1] >> shift === big[1] >> shift;
  };
}

export function entryMatcher(query) {
  const q = query.trim();
  if (!q) return null;
  const ip = ipProbe(q);
  if (ip) return ip;
  const [kind, value] = guess(q);
  const res = check(kind, value);
  if (kind !== "ua" && res.value) {
    const k = `${kind}:${res.value}`;
    return (item) => keyOf(item) === k;
  }
  const needle = q.toLowerCase();
  return (item) =>
    `${entryLabel(item)} ${item.note ?? ""}`.toLowerCase().includes(needle) ||
    (item.kind === "ua" && needle.includes(item.value.toLowerCase()));
}

export const entryLabel = (item) =>
  item.kind === "asn" ? `AS${item.value}` : item.value;

export function kindSummary(items) {
  const byKind = {};
  for (const i of items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
  const nf = new Intl.NumberFormat();
  return KIND_ORDER.filter((k) => byKind[k])
    .map((k) => {
      const [one, many] = COUNT_LABELS[k];
      return `${nf.format(byKind[k])} ${byKind[k] === 1 ? one : many}`;
    })
    .join(", ");
}
