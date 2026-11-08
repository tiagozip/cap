export const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6)
    return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e4) return `${Math.round(v / 1e3)}k`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1).replace(/\.0$/, "")}k`;
  return String(v);
};

export const latency = (ms) => {
  if (!ms) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
};

export const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
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

export const ago = (ts) => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export const until = (ts) => ago(2 * Date.now() - ts).replace(" ago", "");

export const trend = (current, previous) => {
  if (previous == null || (!current && !previous)) return null;
  if (!previous) return { dir: "up", text: "New" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { dir: "flat", text: "0%" };
  return { dir: pct > 0 ? "up" : "down", text: `${Math.abs(pct)}%` };
};

export const bytes = (n) =>
  n > 1e9
    ? `${(n / 1e9).toFixed(1)} GB`
    : n > 1e6
      ? `${(n / 1e6).toFixed(1)} MB`
      : `${Math.round((n ?? 0) / 1e3)} kB`;
