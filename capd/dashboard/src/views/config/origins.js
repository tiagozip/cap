export function normalizeOrigin(value) {
  const val = (value || "").trim();
  if (!val) return "";
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(val) && !/^https?:\/\//i.test(val))
    return "";
  const local =
    /^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(val);
  const withScheme = /^https?:\/\//i.test(val)
    ? val
    : `${local ? "http" : "https"}://${val}`;
  try {
    const parsed = new URL(withScheme);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      return "";
    if (!parsed.hostname.includes("*")) return parsed.origin;
    const labels = parsed.hostname.split(".");
    const valid =
      labels.length >= 3 &&
      labels.every((l) => /^[a-z0-9*-]+$/.test(l)) &&
      !labels.slice(-2).some((l) => l.includes("*")) &&
      labels.slice(1).every((l) => l !== "*");
    return valid ? parsed.origin : "";
  } catch {
    return "";
  }
}

export const sameList = (a, b) =>
  (!a?.length && !b?.length) ||
  (a?.length === b?.length && a.every((v, i) => v === b[i]));
