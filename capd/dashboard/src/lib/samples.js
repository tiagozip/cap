const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const start = Date.UTC(2026, 0, 5);
const iso = (t) => new Date(t).toISOString();
const soon = () => Date.now() + 9 * DAY;
const wave = (i, base, amp) =>
  Math.max(
    0,
    Math.round(
      base + amp * Math.sin(i / 3.8) + (amp / 2) * Math.sin(i / 1.7 + 1),
    ),
  );

const NAMES = [
  "United States",
  "Germany",
  "United Kingdom",
  "India",
  "Brazil",
  "France",
  "Japan",
  "Canada",
];
const COUNTRIES = ["US", "DE", "GB", "IN", "BR", "FR", "JP", "CA", "NL", "ES"];

const totals = {
  total: 9300,
  challenges: 3200,
  solved: 2900,
  failed: 150,
  blocked: 290,
  limited: 30,
  verified: 2700,
  flagged: 280,
  agents: 220,
  avg_solve: 2200,
  ips: 1300,
  clients: 1290,
};

const overview = {
  range: { from: start, to: start + 7 * DAY, bucket: 6 * HOUR },
  summary: totals,
  previous: totals,
  series: Array.from({ length: 28 }, (_, i) => {
    const challenges = wave(i * 6, 22, 10);
    return {
      b: start + i * 6 * HOUR,
      challenges,
      solved: Math.round(challenges * 0.9),
      failed: 1,
      blocked: 2,
      limited: 0,
      verified: Math.round(challenges * 0.85),
      flagged: 2,
    };
  }),
};

const insights = {
  range: overview.range,
  scores: Array.from({ length: 60 }, (_, b) => [
    { b, outcome: "pass", n: Math.round(340 / (1 + b / 6)), flagged: 0 },
    ...(b >= 27 ? [{ b, outcome: "block", n: 4, flagged: 4 }] : []),
  ]).flat(),
  solve: {
    size: 50,
    rows: Array.from({ length: 100 }, (_, b) => ({
      b,
      outcome: "pass",
      n: Math.round(60 * Math.exp(-((b - 40) ** 2) / 500)),
      flagged: 0,
    })),
  },
  hours: Array.from({ length: 168 }, (_, i) => ({
    b: start + i * HOUR,
    n: wave(i, 30, 18),
    bad: 2,
  })),
  flow: [
    { type: "challenge", outcome: "block", n: 127 },
    { type: "challenge", outcome: "limit", n: 26 },
    { type: "challenge", outcome: "pass", n: 3220 },
    { type: "redeem", outcome: "block", n: 163 },
    { type: "redeem", outcome: "fail", n: 157 },
    { type: "redeem", outcome: "limit", n: 7 },
    { type: "redeem", outcome: "pass", n: 2900 },
    { type: "siteverify", outcome: "pass", n: 2723 },
  ],
  shared: Array.from({ length: 4 }, (_, i) => ({
    fp: `00000000000000${i}0`,
    ips: 17 - i,
    n: 90 - i * 10,
    networks: 10,
    countries: 8,
    blocked: 16,
    flagged: 30,
    browser: "Safari",
    os: "macOS",
    first: start,
    last: start + 6 * DAY,
  })),
  countries: {
    current: COUNTRIES.map((value, i) => ({
      value,
      n: Math.round(1900 / (1 + i)),
      blocked: 20,
      flagged: 20,
    })),
    previous: COUNTRIES.map((value, i) => ({
      value,
      n: Math.round(1800 / (1 + i)),
      blocked: 20,
      flagged: 20,
    })),
  },
};

const breakdown = NAMES.map((value, i) => ({
  value,
  name: value,
  n: Math.round(900 / (1 + i * 0.6)),
  blocked: 20,
  flagged: 10,
}));

const events = Array.from({ length: 10 }, (_, i) => ({
  id: `sample-${i}`,
  ts: start + 12 * HOUR - i * 7 * 60_000,
  site_key: "sample",
  type: "redeem",
  outcome: "pass",
  reason: null,
  ip: "203.0.113.10",
  country: "DE",
  asn: 3320,
  asn_org: "Deutsche Telekom",
  ua: null,
  browser: "Chrome",
  os: "macOS",
  platform: "Desktop",
  origin: "example.com",
  lang: "en-US",
  fp: `00000000000000${i}0`,
  protocol: "hashwx",
  solve_ms: 2300,
  score: 0.2,
  verdict: "ok",
  agent: null,
  agent_confidence: null,
  agent_verified: false,
  flags: [],
  rule: null,
  token_id: `sample-token-${i}`,
}));

export const samples = {
  overview,
  insights,
  breakdown,
  events,
  where: {
    country: COUNTRIES.map((value, i) => ({
      value,
      n: Math.round(900 / (1 + i)),
    })),
    asn_org: NAMES.map((_, i) => ({
      value: `Network ${i + 1}`,
      label: null,
      n: Math.round(700 / (1 + i)),
    })),
  },
  apiKeys: [
    {
      id: "sample-1",
      name: "deploy script",
      created: iso(start),
      siteKeys: null,
      readonly: false,
    },
    {
      id: "sample-2",
      name: "read-only reports",
      created: iso(start),
      siteKeys: ["0000000000"],
      readonly: true,
    },
  ],
  lists: [
    { id: "sample-1", name: "Datacenter networks", count: 8 },
    { id: "sample-2", name: "Partner offices", count: 3 },
  ],
  sessions: [
    { token: "AAAAAAAAAAAAAA", expires: iso(soon()) },
    { token: "BBBBBBBBBBBBBB", expires: iso(soon()) },
  ],
  blocked: [
    { type: "ip", ip: "203.0.113.7", permanent: true },
    { type: "cidr", ip: "198.51.100.0/24", permanent: true },
  ],
  shares: [{ id: "sample-1", name: "Marketing team", created: start }],
  rules: [
    {
      id: "sample-1",
      name: "Harder puzzles for datacenter networks",
      enabled: true,
      match: "any",
      action: "harder",
      factor: 3,
      stage: "challenge",
      conditions: [{ field: "asn", op: "eq", value: 16509 }],
    },
    {
      id: "sample-2",
      name: "Block HeadlessChrome",
      enabled: true,
      match: "all",
      action: "block",
      stage: "challenge",
      conditions: [{ field: "browser", op: "eq", value: "HeadlessChrome" }],
    },
    {
      id: "sample-3",
      name: "Allow the office network",
      enabled: true,
      match: "all",
      action: "allow",
      stage: "challenge",
      conditions: [{ field: "ip", op: "in", value: ["203.0.113.0/24"] }],
    },
  ],
  list: {
    id: "sample",
    name: "",
    items: Array.from({ length: 4 }, (_, i) => ({
      kind: "cidr",
      value: `198.51.10${i}.0/24`,
      note: "",
      expires: null,
    })),
  },
  storage: {
    status: {
      backend: "duckdb",
      configured: "duckdb",
      healthy: true,
      lastError: null,
      buffered: 0,
      dropped: 0,
      info: { events: 136_000, bytes: 56_000_000 },
    },
    form: { retentionDays: 30, ipMode: "full", logChallenges: true },
  },
  widgetFiles: {
    enabled: false,
    widget: "0.1.62",
    wasm: "0.0.8",
    builtWith: { widget: "0.1.62", wasm: "0.0.8" },
    source: "https://cdn.jsdelivr.net",
    cached: null,
    updating: false,
    error: null,
  },
  about: { ver: "3.1.17", bun: "1.3.12" },
};
