export const compact = (n) => {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  const a = Math.abs(v);
  if (Math.round(a * 10) / 10 < 1000)
    return `${sign}${Math.round(a * 10) / 10}`;
  for (const [size, unit] of [
    [1e3, "k"],
    [1e6, "M"],
    [1e9, "B"],
  ]) {
    const x = a / size;
    const r = Number(x.toFixed(x < 10 ? 1 : 0));
    if (r < 1000 || unit === "B") return `${sign}${r}${unit}`;
  }
};

export const latency = (ms) => {
  if (!ms || ms < 0) return "0ms";
  if (Math.round(ms) < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 9.95) return `${s.toFixed(1)}s`;
  const secs = Math.round(s);
  if (secs < 60) return `${secs}s`;
  const rest = secs % 60;
  return `${Math.floor(secs / 60)}m${rest ? ` ${rest}s` : ""}`;
};

export const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
export const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
export const fullFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

export const when = (ts) => {
  const d = new Date(ts);
  return new Date().toDateString() === d.toDateString()
    ? timeFmt.format(d)
    : `${dateFmt.format(d)} ${timeFmt.format(d)}`;
};

const span = (s) => {
  for (const [limit, unit, size] of [
    [60, "s", 1],
    [60, "m", 60],
    [24, "h", 3600],
    [31, "d", 86400],
    [12, "mo", 2629800],
    [Number.POSITIVE_INFINITY, "y", 31557600],
  ]) {
    const n = Math.round(s / size);
    if (n < limit) return `${n}${unit}`;
  }
};

export const ago = (ts) => {
  const s = (Date.now() - ts) / 1000;
  return s < 5 ? "just now" : `${span(s)} ago`;
};

export const until = (ts) => span(Math.max((ts - Date.now()) / 1000, 0));

export const trend = (current, previous) => {
  if (previous == null || (!current && !previous)) return null;
  if (!previous) return { dir: "up", text: "New" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { dir: "flat", text: "0%" };
  return { dir: pct > 0 ? "up" : "down", text: `${compact(Math.abs(pct))}%` };
};

export const bytes = (n) => {
  const v = Math.max(Number(n) || 0, 0);
  for (const [size, unit, digits] of [
    [1, "B", 0],
    [1e3, "kB", 0],
    [1e6, "MB", 1],
    [1e9, "GB", 1],
    [1e12, "TB", 1],
  ]) {
    const r = (v / size).toFixed(digits);
    if (Number(r) < 1000 || unit === "TB") return `${r} ${unit}`;
  }
};
