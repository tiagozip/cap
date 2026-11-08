import pkg from "../../../capd/package.json";
import { DATACENTER_ASNS, DAY, HOUR, ipOf, models, RULE_IDS } from "./model.js";

const VERSION = 1;

export const keyDefaults = {
  difficulty: 4,
  challengeCount: 80,
  saltSize: 32,
  instrumentation: true,
  obfuscationLevel: 5,
  blockAutomatedBrowsers: false,
  detectAutomatedInteractions: false,
  blockAutomatedInteractions: false,
  behavior: "off",
  blockAgents: "off",
  allowVerifiedAgents: false,
  protocol: "hashwx",
  hashwxDifficulty: 1_000_000,
  signalActions: {},
  agentActions: {},
  behaviorThreshold: null,
  behaviorStrict: false,
  requireInteraction: false,
};

const randomHex = (bytes) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const randomToken = (bytes) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=+$/, "");

export const newSecret = () => `sk-${randomToken(32)}`;
export const newHex = randomHex;
export const newToken = randomToken;
export const newBase64Url = (bytes) =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const AGES = {
  c4f1a9e27b: 96,
  "8d03be6f52": 210,
  e7a2c90d14: 288,
  "5b98f3a0c6": 345,
  a06d4e81f3: 412,
};

const RULES = {
  blocklist: (sk) => ({
    id: RULE_IDS.blocklist,
    name: "Block entries on this key's blocklist",
    enabled: true,
    match: "all",
    conditions: [{ field: "list", op: "in_list", value: `blk_${sk}` }],
    action: "block",
  }),
  headless: () => ({
    id: RULE_IDS.headless,
    name: "Block HeadlessChrome",
    enabled: true,
    match: "all",
    conditions: [{ field: "browser", op: "eq", value: "HeadlessChrome" }],
    action: "block",
  }),
  harder: () => ({
    id: RULE_IDS.harder,
    name: "Harder puzzles for datacenter networks",
    enabled: true,
    match: "all",
    conditions: [{ field: "list", op: "in_list", value: "l_datacenters" }],
    action: "harder",
    factor: 3,
  }),
  flagScore: () => ({
    id: RULE_IDS.flagScore,
    name: "Flag risky interaction scores",
    enabled: true,
    match: "all",
    conditions: [{ field: "score", op: "gte", value: 0.45 }],
    action: "flag",
  }),
  office: () => ({
    id: RULE_IDS.office,
    name: "Allow the office network",
    enabled: true,
    match: "any",
    conditions: [
      { field: "list", op: "in_list", value: "l_offices" },
      { field: "ip", op: "in", value: ["203.0.113.0/24"] },
    ],
    action: "allow",
  }),
};

function seed() {
  const now = Date.now();
  const day = Math.floor(now / DAY) * DAY;
  const keys = models().map((m) => ({
    siteKey: m.siteKey,
    name: m.def.name,
    created: day - AGES[m.siteKey] * DAY + 9 * HOUR + m.k * 1_234_567,
    secret: newSecret(),
    config: {
      ...keyDefaults,
      ratelimitMax: null,
      ratelimitDuration: null,
      corsOrigins: null,
      blockNonBrowserUA: null,
      requiredHeaders: null,
      ...m.def.config,
      name: m.def.name,
    },
  }));
  const rules = Object.fromEntries(
    models().map((m) => [
      m.siteKey,
      m.def.rules.map((r) => RULES[r](m.siteKey)),
    ]),
  );
  const item = (kind, value, note, ageHours, ttlDays = 0) => ({
    kind,
    value,
    note,
    added: now - ageHours * HOUR,
    expires: ttlDays ? now - ageHours * HOUR + ttlDays * DAY : null,
  });
  const lists = [
    {
      id: "l_datacenters",
      name: "Datacenter networks",
      description:
        "Cloud and hosting providers that real customers rarely browse from",
      created: day - 80 * DAY,
      items: DATACENTER_ASNS.map(([asn, org], i) =>
        item("asn", String(asn), org, 80 * 24 - i * 7),
      ),
    },
    {
      id: "l_offices",
      name: "Office networks",
      description: "Our own offices and VPN exits",
      created: day - 64 * DAY,
      items: [
        item("cidr", "203.0.113.0/24", "Lisbon office", 64 * 24),
        item("cidr", "198.51.100.0/24", "Berlin office", 50 * 24),
        item("cidr", "2001:db8:4::/48", "Corporate VPN", 31 * 24),
      ],
    },
    {
      id: "l_scripts",
      name: "Scripted clients",
      description: "User agents from HTTP libraries and scrapers",
      created: day - 40 * DAY,
      items: [
        item("ua", "python-requests", "", 40 * 24),
        item("ua", "Go-http-client", "", 40 * 24 - 2),
        item("ua", "Scrapy", "", 33 * 24),
        item("ua", "curl/", "", 21 * 24),
      ],
    },
  ];
  for (const m of models()) {
    if (!m.def.rules.includes("blocklist")) continue;
    const blocked = m.cohorts.find((c) => c.kind === "blocked");
    lists.push({
      id: `blk_${m.siteKey}`,
      name: `Blocked on ${m.def.name}`,
      description: "Created from this key's IP blocking rules",
      created: day - 30 * DAY,
      items: [
        ...Array.from({ length: blocked?.U ?? 0 }, (_, i) =>
          item(
            "ip",
            ipOf(blocked, i),
            i ? "" : "Credential stuffing",
            20 * 24 - i * 30,
          ),
        ),
        item(
          "cidr",
          `${blocked.a}.${blocked.b}.0.0/16`,
          "Same hosting range",
          6 * 24,
          30,
        ),
        item("country", "KP", "", 29 * 24),
        item("asn", "9009", "Proxy network", 12 * 24, 7),
      ],
    });
  }
  const webhooks = {
    c4f1a9e27b: [
      {
        id: "wh_3f9a1c2b7d4e",
        name: "Security alerts",
        url: "https://hooks.example.com/cap/security",
        triggers: ["block", "flagged"],
        enabled: true,
        created: day - 41 * DAY,
        secret: `whsec_${newBase64Url(24)}`,
      },
      {
        id: "wh_81d07e5ac29f",
        name: "SIEM export",
        url: "https://siem.example.com/ingest/cap",
        triggers: ["all"],
        enabled: false,
        created: day - 12 * DAY,
        secret: `whsec_${newBase64Url(24)}`,
      },
    ],
    "8d03be6f52": [
      {
        id: "wh_5ac2e9017b3d",
        name: "Agent checkouts",
        url: "https://ingest.example.com/cap/agents",
        triggers: ["agent"],
        enabled: true,
        created: day - 18 * DAY,
        secret: `whsec_${newBase64Url(24)}`,
      },
    ],
  };
  return {
    v: VERSION,
    keys,
    rules,
    lists,
    webhooks,
    deliveries: {},
    apikeys: [
      {
        id: newHex(16),
        name: "Deploy pipeline",
        created: now - 58 * DAY,
        siteKeys: null,
        readonly: false,
      },
      {
        id: newHex(16),
        name: "Grafana dashboard",
        created: now - 23 * DAY,
        siteKeys: null,
        readonly: true,
      },
      {
        id: newHex(16),
        name: "Checkout team",
        created: now - 9 * DAY,
        siteKeys: ["8d03be6f52"],
        readonly: false,
      },
    ],
    sessions: [
      {
        token: newHex(7),
        created: now - 2 * HOUR,
        expires: now + 7 * DAY - 2 * HOUR,
      },
      { token: newHex(7), created: now - 3 * DAY, expires: now + 4 * DAY },
      { token: newHex(7), created: now - 6 * DAY, expires: now + DAY },
    ],
    shares: {
      c4f1a9e27b: [
        {
          id: newHex(8),
          name: "Marketing team",
          created: now - 33 * DAY,
          expires: null,
        },
        {
          id: newHex(8),
          name: "Quarterly review",
          created: now - 5 * DAY,
          expires: now + 25 * DAY,
        },
      ],
    },
    settings: {
      headers: {
        ipHeader: "CF-Connecting-IP",
        countryHeader: "",
        asnHeader: "",
      },
      ratelimit: { max: 30, duration: 5000 },
      cors: { origins: null },
      filtering: { blockNonBrowserUA: false, requiredHeaders: [] },
      analytics: { retentionDays: 90, ipMode: "full", logChallenges: true },
      assets: {
        enabled: false,
        widget: pkg.capAssets.widget,
        wasm: pkg.capAssets.wasm,
      },
      assetsCachedAt: null,
      ipdb: {
        mode: "dbip",
        maxmindAccountId: "",
        maxmindKey: "",
        ipinfoToken: "",
        lastUpdated: new Date(now - 3 * DAY - 5 * HOUR).toISOString(),
        country: { exists: true, size: 7_342_118 },
        asn: { exists: true, size: 9_871_204 },
        loaded: { country: true, asn: true },
        error: null,
      },
    },
    download: null,
  };
}

const load = () => {
  const saved = globalThis.demoSaved;
  return saved?.v === VERSION ? saved : seed();
};

export const state = load();

export const save = () => postMessage({ save: state });

export const about = {
  ver: pkg.version,
  bun: "1.3.12",
  capAssets: pkg.capAssets,
};
