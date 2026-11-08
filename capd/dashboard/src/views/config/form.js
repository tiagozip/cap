import { normalizeOrigin } from "./origins.js";

export const BROWSER_HEADERS = [
  "accept-encoding",
  "accept-language",
  "cache-control",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
];

export const protocolOf = (config) =>
  config?.protocol === "sha256-pow" || (!config?.protocol && !config?.rsw)
    ? "sha256-pow"
    : "hashwx";

export const formFrom = (key) => {
  const c = key.config ?? {};
  return {
    name: key.name ?? "",
    protocol: protocolOf(c),
    difficulty: c.difficulty ?? 4,
    challengeCount: c.challengeCount ?? 80,
    hashwxDifficulty: c.hashwxDifficulty ?? 1_000_000,
    instrumentation: c.instrumentation !== false,
    obfuscationLevel: c.obfuscationLevel ?? 5,
    blockAutomatedBrowsers: !!c.blockAutomatedBrowsers,
    detectAutomatedInteractions: !!c.detectAutomatedInteractions,
    blockAutomatedInteractions: !!c.blockAutomatedInteractions,
    behavior: c.behavior ?? "off",
    blockAgents: c.blockAgents ?? "off",
    allowVerifiedAgents: !!c.allowVerifiedAgents,
    ratelimitMax: c.ratelimitMax ?? null,
    ratelimitSeconds: c.ratelimitDuration ? c.ratelimitDuration / 1000 : null,
    corsOn: !!c.corsOrigins?.length,
    origins: [...(c.corsOrigins ?? [])],
    blockNonBrowserUA: !!c.blockNonBrowserUA,
    headersOn: !!c.requiredHeaders?.length,
    requiredHeaders: [...(c.requiredHeaders ?? [])],
  };
};

export const payloadOf = (f) => {
  const origins = f.corsOn
    ? f.origins.map(normalizeOrigin).filter(Boolean)
    : [];
  const headers = f.headersOn
    ? BROWSER_HEADERS.filter((h) => f.requiredHeaders.includes(h))
    : [];
  const num = (v) =>
    v === null || v === "" || v === undefined ? null : Number(v);
  const seconds = num(f.ratelimitSeconds);
  return {
    name: f.name.trim(),
    protocol: f.protocol,
    difficulty: num(f.difficulty),
    challengeCount: num(f.challengeCount),
    hashwxDifficulty: Number(f.hashwxDifficulty),
    instrumentation: f.instrumentation,
    obfuscationLevel: Number(f.obfuscationLevel),
    blockAutomatedBrowsers: f.instrumentation && f.blockAutomatedBrowsers,
    detectAutomatedInteractions:
      f.instrumentation && f.detectAutomatedInteractions,
    blockAutomatedInteractions:
      f.instrumentation && f.blockAutomatedInteractions,
    behavior: f.behavior,
    blockAgents: f.blockAgents,
    allowVerifiedAgents: f.allowVerifiedAgents,
    ratelimitMax: num(f.ratelimitMax),
    ratelimitDuration: seconds === null ? null : Math.round(seconds * 1000),
    corsOrigins: origins.length ? [...new Set(origins)] : null,
    blockNonBrowserUA: f.blockNonBrowserUA,
    requiredHeaders: headers.length ? headers : null,
  };
};

export const changesOf = (form, baseline) => {
  const next = payloadOf(form);
  const prev = payloadOf(baseline);
  return Object.fromEntries(
    Object.entries(next).filter(
      ([k, v]) => JSON.stringify(v) !== JSON.stringify(prev[k]),
    ),
  );
};
