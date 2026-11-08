const ipv4ToInt = (a) =>
  a.split(".").reduce((r, b) => (r << 8) + Number.parseInt(b, 10), 0) >>> 0;

export function ipv6ToBytes(addr) {
  let a = addr;
  if (a.includes("::")) {
    const [left, right] = a.split("::");
    const l = left ? left.split(":") : [];
    const r = right ? right.split(":") : [];
    a = [...l, ...Array(8 - l.length - r.length).fill("0"), ...r].join(":");
  }
  const hex = a
    .split(":")
    .map((g) => g.padStart(4, "0"))
    .join("");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

const isV4 = (s) => s.includes(".") && !s.includes(":");

export function parseCidr(cidr) {
  const [range, prefix] = String(cidr).split("/");
  const bits = Number.parseInt(prefix, 10);
  if (!range || Number.isNaN(bits)) return null;
  if (isV4(range)) {
    if (bits < 0 || bits > 32 || !/^\d{1,3}(\.\d{1,3}){3}$/.test(range))
      return null;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return { v4: true, mask, base: (ipv4ToInt(range) & mask) >>> 0 };
  }
  if (bits < 0 || bits > 128 || !/^[0-9a-f:]+$/i.test(range)) return null;
  return { v4: false, bits, base: ipv6ToBytes(range) };
}

export function ipInCidr(ip, parsed) {
  if (!ip || !parsed) return false;
  try {
    if (parsed.v4) {
      if (!isV4(ip)) return false;
      return (ipv4ToInt(ip) & parsed.mask) >>> 0 === parsed.base;
    }
    if (isV4(ip)) return false;
    const bytes = ipv6ToBytes(ip);
    const full = Math.floor(parsed.bits / 8);
    for (let i = 0; i < full; i++)
      if (bytes[i] !== parsed.base[i]) return false;
    if (parsed.bits % 8 === 0) return true;
    const mask = 0xff << (8 - (parsed.bits % 8));
    return (bytes[full] & mask) === (parsed.base[full] & mask);
  } catch {
    return false;
  }
}

export const isIp = (s) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(s) ||
  (/^[0-9a-f:]+$/i.test(s) && s.includes(":"));
