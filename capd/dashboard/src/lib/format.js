import { dtf, t } from "./i18n.svelte.js";

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

export const timeFmt = dtf({
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
export const dateFmt = dtf({
  month: "short",
  day: "numeric",
});
export const fullFmt = dtf({
  dateStyle: "medium",
  timeStyle: "medium",
});

export const when = (ts) => {
  const d = new Date(ts);
  return new Date().toDateString() === d.toDateString()
    ? timeFmt.format(d)
    : `${dateFmt.format(d)} ${timeFmt.format(d)}`;
};

export const duration = (sec) => {
  const s = Math.max(Math.round(sec), 0);
  if (s < 60) return t("{n}s", { n: s });
  if (s < 3600) return t("{n}m", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n}h", { n: Math.round(s / 3600) });
  return t("{n}d", { n: Math.round(s / 86400) });
};

export const ago = (ts) => {
  const s = Math.max(Math.round((Date.now() - ts) / 1000), 0);
  if (s < 60) return t("{n}s ago", { n: s });
  if (s < 3600) return t("{n}m ago", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n}h ago", { n: Math.round(s / 3600) });
  return t("{n}d ago", { n: Math.round(s / 86400) });
};

export const until = (ts) => duration((ts - Date.now()) / 1000);

export const trend = (current, previous) => {
  if (previous == null || (!current && !previous)) return null;
  if (!previous) return { dir: "up", text: t("New") };
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
