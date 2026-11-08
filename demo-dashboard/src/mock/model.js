import { SIGNED_AGENTS } from "../../../capd/src/policy/signals.js";

export const MIN = 60_000;
export const HOUR = 3_600_000;
export const DAY = 86_400_000;
export const EPOCH_MIN = Date.UTC(2025, 0, 1) / MIN;
export const MAX_SPAN = 40_000;

const mix = (v) => {
  let x = Math.imul(v ^ (v >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
};
export const h2 = (a, b) => mix(mix(a ^ 0x9e3779b9) ^ b);
export const h3 = (a, b, c) => mix(h2(a, b) ^ c);
export const h4 = (a, b, c, d) => mix(h3(a, b, c) ^ d);
export const unit = (h) => h / 4294967296;

export const prng = (seed) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const feistel = (l, r, k) => {
  const a = (l ^ mix(r ^ k)) >>> 0;
  const b = (r ^ mix(a ^ (k + 0x2c1b3c6d))) >>> 0;
  return [(a ^ mix(b ^ (k + 0x7a3d9e45))) >>> 0, b];
};
const unfeistel = (l, r, k) => {
  const a = (l ^ mix(r ^ (k + 0x7a3d9e45))) >>> 0;
  const b = (r ^ mix(a ^ (k + 0x2c1b3c6d))) >>> 0;
  return [(a ^ mix(b ^ k)) >>> 0, b];
};
const hex8 = (n) => n.toString(16).padStart(8, "0");
const TOKEN_KEY = 0x51ed27f3;
const FP_KEY = 0x1b873593;
const TOKEN_CHECK = 0xa7c;

export const encodeVisit = (k, m, j, s) => {
  const [l, r] = feistel(
    ((m - EPOCH_MIN) | (k << 22)) >>> 0,
    (j | (s << 13) | (TOKEN_CHECK << 20)) >>> 0,
    TOKEN_KEY,
  );
  return hex8(l) + hex8(r);
};

export const decodeVisit = (token) => {
  if (!/^[0-9a-f]{16}$/.test(token ?? "")) return null;
  const [l, r] = unfeistel(
    Number.parseInt(token.slice(0, 8), 16),
    Number.parseInt(token.slice(8), 16),
    TOKEN_KEY,
  );
  if (r >>> 20 !== TOKEN_CHECK || l >>> 25) return null;
  return {
    k: l >>> 22,
    m: (l & 0x3fffff) + EPOCH_MIN,
    j: r & 0x1fff,
    s: (r >>> 13) & 0x7f,
  };
};

export const encodeEventId = (ts, token, e) =>
  `${ts.toString(16).padStart(12, "0")}7${(e | (h2(ts | 0, e) & 0xff0))
    .toString(16)
    .padStart(3, "0")}${token}`;

export const decodeEventId = (id) => {
  if (!/^[0-9a-f]{32}$/.test(id ?? "")) return null;
  const visit = decodeVisit(id.slice(16));
  if (!visit) return null;
  return {
    ...visit,
    ts: Number.parseInt(id.slice(0, 12), 16),
    e: Number.parseInt(id.slice(13, 16), 16) & 0xf,
  };
};

export const encodeFp = (k, c, idx) => {
  const [l, r] = feistel(
    (idx | (c << 16) | (k << 26)) >>> 0,
    0x6a09e667 ^ k,
    FP_KEY,
  );
  return hex8(l) + hex8(r);
};

export const decodeFp = (fp) => {
  if (!/^[0-9a-f]{16}$/.test(fp ?? "")) return null;
  const [l, r] = unfeistel(
    Number.parseInt(fp.slice(0, 8), 16),
    Number.parseInt(fp.slice(8), 16),
    FP_KEY,
  );
  const k = l >>> 26;
  if (r !== (0x6a09e667 ^ k) >>> 0) return null;
  return { k, c: (l >>> 16) & 0x3ff, idx: l & 0xffff };
};

const POOL = 65024;
const STRIDE = 40503;
const STRIDE_INV = (() => {
  let [a, b, x0, x1] = [STRIDE, POOL, 1, 0];
  while (b) {
    const q = Math.floor(a / b);
    [a, b] = [b, a - q * b];
    [x0, x1] = [x1, x0 - q * x1];
  }
  return ((x0 % POOL) + POOL) % POOL;
})();

export const ipOf = (cohort, idx) => {
  const pos = (idx * STRIDE + cohort.off) % POOL;
  return `${cohort.a}.${cohort.b}.${Math.floor(pos / 254)}.${1 + (pos % 254)}`;
};

export const ipIndex = (cohort, c3, d) => {
  if (d < 1 || d > 254 || c3 > 255) return -1;
  const pos = c3 * 254 + d - 1;
  const idx = (((pos - cohort.off + POOL) % POOL) * STRIDE_INV) % POOL;
  return idx < cohort.U ? idx : -1;
};

export function parseUA(ua) {
  if (!ua) return { platform: "", os: "", browser: "" };
  let os = "";
  if (/iPad/.test(ua)) os = "iPadOS";
  else if (/iPhone/.test(ua)) os = "iOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Macintosh|Mac OS X/.test(ua)) os = "macOS";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Linux/.test(ua)) os = "Linux";
  let platform = "";
  if (/iPhone|Android.*Mobile|Mobile.*Android/.test(ua)) platform = "Phone";
  else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) platform = "Tablet";
  else if (/Macintosh|Windows|Linux|CrOS/.test(ua)) platform = "Desktop";
  let browser = "Non-browser";
  if (/HeadlessChrome/.test(ua)) browser = "HeadlessChrome";
  else if (/\bEdg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/\bOPR\/|\bOpera\b/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet";
  else if (/\bFirefox\/|\bFxiOS\//.test(ua)) browser = "Firefox";
  else if (/\bChrome\/|\bCriOS\//.test(ua)) browser = "Chrome";
  else if (/\bVersion\/[\d.]+.*Safari\//.test(ua)) browser = "Safari";
  else if (/^Mozilla\//.test(ua)) browser = "Other";
  return { platform, os, browser };
}

const COUNTRIES = [
  [
    "US",
    25,
    ["en-US", "es-US"],
    [
      [7922, "Comcast Cable"],
      [7018, "AT&T Internet"],
      [701, "Verizon Business"],
      [20115, "Charter Communications"],
      [21928, "T-Mobile USA"],
      [22773, "Cox Communications"],
    ],
  ],
  [
    "DE",
    8,
    ["de-DE"],
    [
      [3320, "Deutsche Telekom"],
      [3209, "Vodafone GmbH"],
      [6805, "Telefonica Germany"],
    ],
  ],
  [
    "GB",
    7,
    ["en-GB"],
    [
      [2856, "British Telecommunications"],
      [5607, "Sky UK"],
      [5089, "Virgin Media"],
    ],
  ],
  [
    "IN",
    6,
    ["en-IN", "hi-IN"],
    [
      [55836, "Reliance Jio Infocomm"],
      [9498, "Bharti Airtel"],
    ],
  ],
  [
    "BR",
    5,
    ["pt-BR"],
    [
      [28573, "Claro NXT"],
      [26599, "Telefonica Brasil"],
    ],
  ],
  [
    "FR",
    4.5,
    ["fr-FR"],
    [
      [3215, "Orange"],
      [12322, "Free SAS"],
      [15557, "SFR"],
    ],
  ],
  [
    "CA",
    3.5,
    ["en-CA", "fr-CA"],
    [
      [812, "Rogers Communications"],
      [577, "Bell Canada"],
    ],
  ],
  [
    "JP",
    3.4,
    ["ja-JP"],
    [
      [4713, "NTT Communications"],
      [2516, "KDDI"],
      [17676, "SoftBank"],
    ],
  ],
  ["ES", 2.5, ["es-ES"], [[3352, "Telefonica de Espana"]]],
  ["IT", 2.4, ["it-IT"], [[3269, "Telecom Italia"]]],
  [
    "NL",
    2.2,
    ["nl-NL"],
    [
      [1136, "KPN"],
      [33915, "Vodafone Ziggo"],
    ],
  ],
  ["MX", 2, ["es-MX"], [[8151, "Uninet"]]],
  [
    "AU",
    2,
    ["en-AU"],
    [
      [1221, "Telstra"],
      [7545, "TPG Telecom"],
    ],
  ],
  ["PL", 1.8, ["pl-PL"], [[5617, "Orange Polska"]]],
  ["ID", 1.6, ["id-ID"], [[7713, "Telkom Indonesia"]]],
  ["KR", 1.5, ["ko-KR"], [[4766, "Korea Telecom"]]],
  [
    "PT",
    1.4,
    ["pt-PT"],
    [
      [3243, "MEO"],
      [2860, "NOS"],
    ],
  ],
  ["TR", 1.3, ["tr-TR"], [[9121, "Turk Telekom"]]],
  ["SE", 1.2, ["sv-SE"], [[3301, "Telia"]]],
  ["PH", 1, ["en-PH"], [[9299, "PLDT"]]],
  ["VN", 1, ["vi-VN"], [[7552, "Viettel"]]],
  ["AR", 0.9, ["es-AR"], [[7303, "Telecom Argentina"]]],
  ["CH", 0.8, ["de-CH", "fr-CH"], [[3303, "Swisscom"]]],
  ["BE", 0.8, ["nl-BE", "fr-BE"], [[5432, "Proximus"]]],
  ["NG", 0.7, ["en-NG"], [[29465, "MTN Nigeria"]]],
  ["ZA", 0.6, ["en-ZA"], [[36994, "Vodacom"]]],
  ["UA", 0.6, ["uk-UA"], [[15895, "Kyivstar"]]],
  ["AT", 0.6, ["de-AT"], [[8447, "A1 Telekom Austria"]]],
  ["SG", 0.6, ["en-SG"], [[7473, "Singtel"]]],
  ["IE", 0.5, ["en-IE"], [[5466, "Eir"]]],
  ["TW", 0.5, ["zh-TW"], [[3462, "Chunghwa Telecom"]]],
  ["RU", 0.5, ["ru-RU"], [[12389, "Rostelecom"]]],
  ["NZ", 0.4, ["en-NZ"], [[4771, "Spark New Zealand"]]],
  ["EG", 0.4, ["ar-EG"], [[8452, "TE Data"]]],
  ["CN", 0.3, ["zh-CN"], [[4134, "China Telecom"]]],
];

const DATACENTERS = [
  [16509, "Amazon.com", ["US", "US", "DE", "IE", "SG", "JP"], 9],
  [396982, "Google Cloud", ["US", "US", "NL", "BE"], 6],
  [8075, "Microsoft Corporation", ["US", "NL", "IE"], 5],
  [14061, "DigitalOcean", ["US", "DE", "NL", "SG", "GB"], 7],
  [24940, "Hetzner Online", ["DE", "DE", "FI"], 7],
  [16276, "OVH SAS", ["FR", "FR", "CA", "PL"], 6],
  [20473, "The Constant Company", ["US", "JP", "NL"], 4],
  [63949, "Akamai Connected Cloud", ["US", "DE", "SG"], 3],
  [45102, "Alibaba US Technology", ["US", "SG"], 2],
  [51167, "Contabo", ["DE", "US"], 3],
  [9009, "M247 Europe", ["RO", "GB", "NL"], 3],
  [31898, "Oracle Corporation", ["US", "BR"], 2],
];

export const DATACENTER_ASNS = DATACENTERS.map(([asn, org]) => [asn, org]);

const CV = () => "150.0.0.0";
const HUMAN_UAS = [
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    31,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    8,
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
    17,
  ],
  [
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Mobile Safari/537.36",
    15,
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36 Edg/{cv}",
    6,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Safari/605.1.15",
    6,
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
    3.5,
  ],
  [
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/146.0.0.0 Mobile Safari/537.36",
    2.5,
  ],
  [
    "Mozilla/5.0 (iPad; CPU OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
    2,
  ],
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/{cv} Mobile/15E148 Safari/604.1",
    2,
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    1.3,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
    1,
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36 OPR/135.0.0.0",
    1,
  ],
  [
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    0.8,
  ],
  [
    "Mozilla/5.0 (Linux; Android 16; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    0.7,
  ],
];
const DESKTOP_UAS = [
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    6,
  ],
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    2,
  ],
  [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{cv} Safari/537.36",
    2,
  ],
];
const HEADLESS_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/{cv} Safari/537.36";
const NON_BROWSER_UAS = [
  ["python-requests/2.32.3", 5],
  ["curl/8.11.1", 3],
  ["Go-http-client/2.0", 3],
  ["axios/1.8.4", 2],
  ["Scrapy/2.13.0 (+https://scrapy.org)", 1],
  ["node-fetch/1.0 (+https://github.com/bitinn/node-fetch)", 1],
];

const AGENTS = [
  ["chatgpt-agent", 16, "high"],
  ["claude-in-chrome", 14, "high"],
  ["cdp-automation", 10, "high"],
  ["perplexity-comet", 9, "medium"],
  ["browser-use", 8, "high"],
  ["gemini-in-chrome", 7, "medium"],
  ["google-agent", 6, "high"],
  ["browserbase", 5, "high"],
  ["stagehand", 4, "high"],
  ["manus", 3, "high"],
  ["nova-act", 3, "medium"],
  ["codex", 3, "high"],
  ["skyvern", 2, "high"],
];

export const PROFILES = ["human", "scraper", "stealth", "agent", "solver"];

const WEAK_FLAGS = [
  ["bh_warp_click", 0.5],
  ["bh_unexplained_scroll", 0.27],
  ["bh_center_hit", 0.23],
];

export const SCORE_CLASSES = {
  clean: ["prod", 0, 0.32],
  mild: ["tri", 0.12, 0.45],
  scraperLow: ["tri", 0.1, 0.45],
  scraperHigh: ["tri", 0.75, 1],
  stealthMid: ["tri", 0.45, 0.745],
  stealthHigh: ["tri", 0.75, 0.98],
  agent: ["tri", 0.45, 0.74],
  solver: ["tri", 0.75, 1],
};

export const sampleScore = (cls, r) => {
  const [kind, lo, hi] = SCORE_CLASSES[cls];
  const u = kind === "prod" ? r() * r() : (r() + r()) / 2;
  return Math.round((lo + (hi - lo) * u) * 100) / 100;
};

const scoreCdf = ([kind, lo, hi], x) => {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const y = (x - lo) / (hi - lo);
  if (kind === "prod") return y - y * Math.log(y);
  return y < 0.5 ? 2 * y * y : 1 - 2 * (1 - y) ** 2;
};

const scoreHists = new Map();
export const scoreHist = (cls) => {
  const hit = scoreHists.get(cls);
  if (hit) return hit;
  const spec = SCORE_CLASSES[cls];
  const hist = new Float64Array(101);
  for (let i = 0; i <= 100; i++)
    hist[i] = scoreCdf(spec, (i + 0.5) / 100) - scoreCdf(spec, (i - 0.5) / 100);
  scoreHists.set(cls, hist);
  return hist;
};

const erf = (x) => {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return s * y;
};
const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

export const sampleSolve = ([median, sigma], r) => {
  const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return Math.max(120, Math.round(median * Math.exp(sigma * z)));
};

const solveHists = new Map();
export const solveHist = (cls) => {
  const id = `${cls[0]}:${cls[1]}`;
  const hit = solveHists.get(id);
  if (hit) return hit;
  const [median, sigma] = cls;
  const hist = new Float64Array(1201);
  let prev = 0;
  for (let i = 0; i < 1200; i++) {
    const next = phi(Math.log(((i + 1) * 50) / median) / sigma);
    hist[i] = next - prev;
    prev = next;
  }
  hist[1200] = 1 - prev;
  solveHists.set(id, hist);
  return hist;
};
export const solveMean = ([median, sigma]) =>
  median * Math.exp((sigma * sigma) / 2);

const pick = (r, list) => {
  let total = 0;
  for (const x of list) total += x[1];
  let v = r() * total;
  for (const x of list) {
    v -= x[1];
    if (v <= 0) return x;
  }
  return list[0];
};
const one = (r, list) => list[Math.floor(r() * list.length)];
const lognormal = (r, sigma) =>
  Math.exp(
    sigma * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()),
  );

export const SEED_KEYS = [
  {
    siteKey: "c4f1a9e27b",
    name: "Account login",
    weekend: 0.78,
    ageDays: 412,
    monthly: 15_400_000,
    origins: [
      ["accounts.example.com", 91],
      ["app.example.com", 9],
    ],
    bots: { scraper: 0.028, stealth: 0.045, agent: 0.012, solver: 0.014 },
    bursts: { stealth: [0.32, 7, 14], scraper: [0.18, 4, 8] },
    difficulty: 1_000_000,
    config: {
      behavior: "block",
      blockAutomatedBrowsers: true,
      detectAutomatedInteractions: true,
      blockAutomatedInteractions: true,
      blockAgents: "identified",
      allowVerifiedAgents: true,
      corsOrigins: ["accounts.example.com", "app.example.com"],
      signalActions: { webdriver_stripped: "block" },
      requiredHeaders: ["accept-language"],
    },
    rules: ["blocklist", "headless", "harder", "flagScore", "office"],
  },
  {
    siteKey: "8d03be6f52",
    name: "Checkout",
    weekend: 1.6,
    ageDays: 389,
    monthly: 8_700_000,
    origins: [["shop.example.com", 100]],
    bots: { scraper: 0.02, stealth: 0.016, agent: 0.034, solver: 0.006 },
    bursts: { solver: [0.2, 8, 10], stealth: [0.12, 5, 6] },
    difficulty: 800_000,
    config: {
      behavior: "report",
      blockAutomatedBrowsers: true,
      blockAgents: "off",
      allowVerifiedAgents: true,
      corsOrigins: ["shop.example.com"],
      agentActions: { "browser-use": "block", "cdp-automation": "block" },
    },
    rules: ["harder", "flagScore"],
  },
  {
    siteKey: "e7a2c90d14",
    name: "Sign up",
    weekend: 1.38,
    ageDays: 377,
    monthly: 6_100_000,
    origins: [
      ["example.com", 72],
      ["app.example.com", 28],
    ],
    bots: { scraper: 0.05, stealth: 0.02, agent: 0.006, solver: 0.04 },
    bursts: { solver: [0.28, 6, 9], scraper: [0.25, 5, 7] },
    difficulty: 1_500_000,
    config: {
      behavior: "block",
      blockAutomatedBrowsers: true,
      blockAgents: "all",
      allowVerifiedAgents: false,
      blockNonBrowserUA: true,
      ratelimitMax: 20,
      ratelimitDuration: 10000,
      hashwxDifficulty: 1_500_000,
      corsOrigins: ["example.com", "app.example.com"],
    },
    rules: ["blocklist", "headless", "flagScore"],
  },
  {
    siteKey: "5b98f3a0c6",
    name: "Comments",
    weekend: 1.65,
    ageDays: 301,
    monthly: 4_100_000,
    origins: [
      ["blog.example.com", 80],
      ["community.example.com", 20],
    ],
    bots: { scraper: 0.065, stealth: 0.01, agent: 0.012, solver: 0.02 },
    bursts: { scraper: [0.26, 6, 9] },
    difficulty: 600_000,
    config: {
      behavior: "report",
      blockAutomatedBrowsers: false,
      blockNonBrowserUA: true,
      protocol: "sha256-pow",
      difficulty: 4,
      challengeCount: 50,
    },
    rules: ["headless"],
  },
  {
    siteKey: "a06d4e81f3",
    name: "Contact form",
    weekend: 0.88,
    ageDays: 166,
    monthly: 860_000,
    origins: [["example.com", 100]],
    bots: { scraper: 0.09, stealth: 0.005, agent: 0.008, solver: 0.012 },
    bursts: { scraper: [0.15, 4, 6] },
    difficulty: 1_000_000,
    config: {
      behavior: "off",
      blockAutomatedBrowsers: true,
      blockNonBrowserUA: true,
    },
    rules: [],
  },
];

export const RULE_IDS = {
  blocklist: "blocklist",
  headless: "block-headlesschrome",
  harder: "harder-puzzles-for-datacenter-networks",
  flagScore: "flag-risky-interaction-scores",
  office: "allow-the-office-network",
};
export const FLAG_SCORE = 0.45;

const TZ = {
  US: -6,
  CA: -5,
  MX: -6,
  BR: -3,
  AR: -3,
  GB: 0,
  IE: 0,
  NG: 1,
  DE: 1,
  FR: 1,
  ES: 1,
  IT: 1,
  NL: 1,
  PL: 1,
  SE: 1,
  CH: 1,
  BE: 1,
  AT: 1,
  ZA: 2,
  EG: 2,
  UA: 2,
  TR: 3,
  RU: 3,
  IN: 5.5,
  ID: 7,
  VN: 7,
  SG: 8,
  PH: 8,
  CN: 8,
  TW: 8,
  JP: 9,
  KR: 9,
  AU: 10,
  NZ: 12,
};
const WEEKDAY_SHAPE = [
  0.36, 0.22, 0.15, 0.11, 0.1, 0.13, 0.25, 0.47, 0.71, 0.87, 0.94, 0.97, 0.9,
  0.95, 1, 0.98, 0.94, 0.91, 0.93, 1.01, 1.06, 1, 0.81, 0.57,
];
const WEEKEND_SHAPE = [
  0.47, 0.33, 0.22, 0.15, 0.12, 0.11, 0.15, 0.25, 0.41, 0.6, 0.77, 0.87, 0.91,
  0.9, 0.88, 0.86, 0.86, 0.88, 0.92, 0.98, 1, 0.93, 0.77, 0.6,
];
const DAY_LEVEL = [0.81, 1.04, 1.08, 1.07, 1.03, 0.97, 0.83];

const localLoad = (dow, hour, weekend) => {
  const i = Math.floor(hour);
  const f = hour - i;
  const at = (n) => {
    const d = (((dow + Math.floor(n / 24)) % 7) + 7) % 7;
    const off = d === 0 || d === 6;
    return (
      (off ? WEEKEND_SHAPE : WEEKDAY_SHAPE)[((n % 24) + 24) % 24] *
      DAY_LEVEL[d] *
      (off ? weekend : 1)
    );
  };
  return at(i) * (1 - f) + at(i + 1) * f;
};

const weekShapes = new Map();
const weekShape = (k, weekend = 1) => {
  const hit = weekShapes.get(k);
  if (hit) return hit;
  const r = prng(h2(0x7a11, k));
  const mixture = COUNTRIES.map(([c, w]) => [TZ[c] ?? 1, w * (0.5 + r())]);
  const tilt = Array.from({ length: 24 }, () => 0.9 + 0.2 * r());
  const out = new Float64Array(168);
  for (let dow = 0; dow < 7; dow++)
    for (let h = 0; h < 24; h++) {
      let load = 0;
      for (const [off, w] of mixture)
        load += w * localLoad(dow, h + off, weekend);
      out[dow * 24 + h] = load * tilt[h];
    }
  const mean = out.reduce((x, y) => x + y) / 168;
  for (let i = 0; i < 168; i++) out[i] /= mean;
  weekShapes.set(k, out);
  return out;
};

const wobble = (k, salt, x) => {
  const i = Math.floor(x);
  const f = x - i;
  const a = unit(h3(k, salt, i));
  const b = unit(h3(k, salt, i + 1));
  return a + (b - a) * f * f * (3 - 2 * f);
};

const CAMPAIGNS = {
  1: { block: 5, active: 0.45, idle: 0.08 },
  2: { block: 30, active: 0.55, idle: 0.12 },
  4: { block: 9, active: 0.35, idle: 0.05 },
};

function buildKey(def, k) {
  const r = prng(h2(0x5eed, k));
  const usedPrefixes = new Set();
  const prefix = () => {
    for (;;) {
      const a = 12 + Math.floor(r() * 210);
      if ([100, 127, 169, 172, 192, 198, 203].includes(a)) continue;
      const b = Math.floor(r() * 256);
      const id = `${a}.${b}`;
      if (usedPrefixes.has(id)) continue;
      usedPrefixes.add(id);
      return { a, b, off: Math.floor(r() * POOL) };
    }
  };
  const cfg = def.config;
  const behaviorOn = cfg.behavior !== "off";
  const blockBehavior = cfg.behavior === "block";
  const rules = new Set(def.rules);
  const shares = {
    human: 1 - Object.values(def.bots).reduce((a, b) => a + b, 0),
    ...def.bots,
  };
  const diff = (def.difficulty / 1_000_000) ** 0.9;
  const cohorts = [];
  const templates = [];
  const profileWeights = PROFILES.map(() => 0);
  const origin = () => pick(r, def.origins)[0];
  const cv = () => `${148 + Math.floor(r() * 3)}.0.0.0`;

  const addCohort = (p, attrs, weight, U) => {
    const ua = attrs.ua.replaceAll("{cv}", attrs.cv ?? CV());
    const cohort = {
      i: cohorts.length,
      p,
      weight,
      ...attrs,
      ua,
      ...parseUA(ua),
      U: Math.max(1, Math.min(POOL, Math.round(U))),
      ...prefix(),
    };
    cohorts.push(cohort);
    return cohort;
  };

  const challengePass = (cohort) =>
    cohort.dc && rules.has("harder")
      ? {
          type: "challenge",
          outcome: "pass",
          reason: "harder_x3",
          rule: RULE_IDS.harder,
        }
      : { type: "challenge", outcome: "pass" };
  const solveFor = (cohort, base) =>
    cohort.dc && rules.has("harder")
      ? [Math.round(base[0] * diff * 3), base[1]]
      : [Math.round(base[0] * diff), base[1]];
  const redeem = (outcome, extra = {}) => ({
    type: "redeem",
    outcome,
    ...extra,
  });
  const verify = (outcome = "pass", reason = "") => ({
    type: "siteverify",
    outcome,
    reason,
  });
  const behaviorFields = (flags, scoreClass, verdict) =>
    behaviorOn
      ? { flags, score: scoreClass, verdict }
      : {
          flags: flags.filter((f) => !f.startsWith("bh_")),
          score: null,
          verdict: "",
        };
  const scoreRule = (f) =>
    rules.has("flagScore") && f.score && SCORE_CLASSES[f.score][1] >= FLAG_SCORE
      ? {
          ...f,
          flags: [...f.flags, `rule:${RULE_IDS.flagScore}`],
          rule: RULE_IDS.flagScore,
        }
      : f;

  const addTemplates = (cohort, paths, solve) => {
    let total = 0;
    for (const [, w] of paths) total += w;
    for (const [events, w] of paths) {
      const share = (cohort.weight * w) / total;
      templates.push({
        j: templates.length,
        c: cohort.i,
        p: cohort.p,
        w: share,
        events,
        solve,
      });
      profileWeights[cohort.p] += share;
    }
  };

  for (let n = 0; n < 230; n++) {
    const [country, , langs, isps] = pick(r, COUNTRIES);
    const [asn, org] = one(r, isps);
    const lang = r() < 0.12 ? "en-US" : one(r, langs);
    const weight = lognormal(r, 1.05);
    const cohort = addCohort(
      0,
      {
        country,
        asn,
        org,
        lang,
        origin: origin(),
        ua: pick(r, HUMAN_UAS)[0],
        cv: cv(),
        kind: "human",
      },
      weight,
      0,
    );
    const solve = solveFor(
      cohort,
      cohort.platform === "Phone"
        ? [2500, 0.5]
        : cohort.platform === "Tablet"
          ? [2000, 0.46]
          : [1450, 0.42],
    );
    const ok = behaviorFields([], "clean", "ok");
    const ch = challengePass(cohort);
    const paths = [
      [[ch, redeem("pass", ok), verify("pass")], 0.856],
      ...WEAK_FLAGS.map(([flag, w]) => [
        [ch, redeem("pass", behaviorFields([flag], "mild", "ok")), verify()],
        0.03 * w,
      ]),
      [[ch, redeem("pass", ok)], 0.035],
      [[ch], 0.045],
      [[ch, redeem("fail", { reason: "expired" })], 0.006],
      [[ch, redeem("fail", { reason: "already_redeemed" })], 0.003],
      [[ch, redeem("fail", { reason: "invalid_solution" })], 0.003],
      [[ch, redeem("pass", ok), verify("fail", "token_expired")], 0.004],
      [
        [{ type: "challenge", outcome: "limit", reason: "rate_limited" }],
        cfg.ratelimitMax ? 0.005 : 0.002,
      ],
    ];
    addTemplates(cohort, paths, solve);
  }

  const dcCohort = (p, kind, ua, weight, U) => {
    const [asn, org, countries] = pick(r, DATACENTERS);
    return addCohort(
      p,
      {
        country: one(r, countries),
        asn,
        org,
        lang: r() < 0.7 ? "en-US" : "",
        origin: origin(),
        ua,
        cv: cv(),
        kind,
        dc: true,
      },
      weight,
      U,
    );
  };
  const residential = (p, kind, ua, weight, U) => {
    const [country, , langs, isps] = pick(r, COUNTRIES);
    const [asn, org] = one(r, isps);
    return addCohort(
      p,
      {
        country,
        asn,
        org,
        lang: one(r, langs),
        origin: origin(),
        ua,
        cv: cv(),
        kind,
      },
      weight,
      U,
    );
  };
  const limit = { type: "challenge", outcome: "limit", reason: "rate_limited" };
  const scraperSolve = [900, 0.35];

  for (let n = 0; n < 34; n++) {
    const kind = pick(r, [
      ["headless", 3],
      ["nonbrowser", 3],
      ["webdriver", 3],
      ["tamper", 2],
    ])[0];
    const weight = lognormal(r, 0.9);
    const U = 4 + r() * 180;
    if (kind === "headless") {
      const cohort = dcCohort(1, kind, HEADLESS_UA, weight, U);
      const flags = behaviorFields(
        ["headless_token"],
        "scraperHigh",
        "automated",
      );
      addTemplates(
        cohort,
        rules.has("headless")
          ? [
              [
                [
                  {
                    type: "challenge",
                    outcome: "block",
                    reason: `rule:${RULE_IDS.headless}`,
                    rule: RULE_IDS.headless,
                  },
                ],
                0.92,
              ],
              [[limit], 0.08],
            ]
          : cfg.blockAutomatedBrowsers
            ? [
                [
                  [
                    challengePass(cohort),
                    redeem("block", {
                      ...flags,
                      reason: "instr_automated_browser",
                    }),
                  ],
                  0.9,
                ],
                [[limit], 0.1],
              ]
            : [
                [
                  [challengePass(cohort), redeem("pass", flags), verify()],
                  0.85,
                ],
                [[challengePass(cohort)], 0.15],
              ],
        solveFor(cohort, scraperSolve),
      );
      continue;
    }
    if (kind === "nonbrowser") {
      const cohort = dcCohort(1, kind, pick(r, NON_BROWSER_UAS)[0], weight, U);
      addTemplates(
        cohort,
        cfg.blockNonBrowserUA
          ? [
              [
                [
                  {
                    type: "challenge",
                    outcome: "block",
                    reason: "non_browser_ua",
                  },
                ],
                1,
              ],
            ]
          : [
              [[challengePass(cohort)], 0.75],
              [
                [
                  challengePass(cohort),
                  redeem("fail", { reason: "invalid_solutions" }),
                ],
                0.25,
              ],
            ],
        null,
      );
      continue;
    }
    const residentialProxy = r() < 0.35;
    const ua = pick(r, DESKTOP_UAS)[0];
    const cohort = residentialProxy
      ? residential(1, kind, ua, weight, U * 20)
      : dcCohort(1, kind, ua, weight, U);
    if (kind === "webdriver") {
      const f = behaviorFields(
        r() < 0.5
          ? ["webdriver_stripped"]
          : ["webdriver_stripped", "cdp_console_trap"],
        "scraperLow",
        "ok",
      );
      const blocked =
        cfg.signalActions?.webdriver_stripped === "block"
          ? redeem("block", { ...f, reason: "signal:webdriver_stripped" })
          : cfg.blockAutomatedBrowsers
            ? redeem("block", { ...f, reason: "instr_automated_browser" })
            : null;
      addTemplates(
        cohort,
        [
          [
            blocked
              ? [challengePass(cohort), blocked]
              : [challengePass(cohort), redeem("pass", f), verify()],
            0.82,
          ],
          [
            [
              challengePass(cohort),
              redeem("fail", { reason: "invalid_solution" }),
            ],
            0.05,
          ],
          [[challengePass(cohort)], 0.07],
          [[limit], 0.06],
        ],
        solveFor(cohort, scraperSolve),
      );
      continue;
    }
    const f = behaviorFields(
      ["native_tamper", "bh_untrusted_activation"],
      "scraperHigh",
      "automated",
    );
    addTemplates(
      cohort,
      [
        [
          blockBehavior
            ? [
                challengePass(cohort),
                redeem("block", { ...f, reason: "behavior_automated" }),
              ]
            : cfg.blockAutomatedBrowsers
              ? [
                  challengePass(cohort),
                  redeem("block", { ...f, reason: "instr_automated_browser" }),
                ]
              : [challengePass(cohort), redeem("pass", scoreRule(f)), verify()],
          0.9,
        ],
        [[limit], 0.1],
      ],
      solveFor(cohort, scraperSolve),
    );
  }

  const STEALTH = [
    [["bh_warp_click", "bh_instant_press", "bh_center_hit"], "stealthMid", 4],
    [["bh_linear_path", "bh_instant_press"], "stealthHigh", 3],
    [["viewport_override", "bh_warp_click"], "stealthMid", 2],
    [["geometry_quantized", "bh_center_hit"], "stealthMid", 2],
    [["stealth_patches", "bh_linear_path"], "stealthHigh", 1.5],
  ];
  for (let n = 0; n < 30; n++) {
    const [flags, cls] = pick(
      r,
      STEALTH.map((s) => [s, s[2]]),
    )[0];
    const cohort = residential(
      2,
      "stealth",
      pick(r, DESKTOP_UAS)[0],
      lognormal(r, 0.8),
      300 + r() * 6000,
    );
    const verdict = SCORE_CLASSES[cls][1] >= 0.75 ? "automated" : "suspicious";
    const f = behaviorFields(flags, cls, verdict);
    const high = verdict === "automated";
    const blocked =
      (high && blockBehavior) ||
      (flags.includes("stealth_patches") && cfg.blockAutomatedBrowsers);
    const ch = challengePass(cohort);
    addTemplates(
      cohort,
      [
        [
          blocked
            ? [
                ch,
                redeem("block", {
                  ...f,
                  reason:
                    flags.includes("stealth_patches") &&
                    cfg.blockAutomatedBrowsers
                      ? "instr_automated_browser"
                      : "behavior_automated",
                }),
              ]
            : [ch, redeem("pass", scoreRule(f)), verify()],
          0.84,
        ],
        [[ch, redeem("fail", { reason: "invalid_solution" })], 0.04],
        [[ch], 0.04],
        [[limit], cfg.ratelimitMax ? 0.12 : 0.08],
      ],
      solveFor(cohort, [1700, 0.38]),
    );
  }

  for (let n = 0; n < 18; n++) {
    const [agent, , confidence] = pick(r, AGENTS);
    const signed = SIGNED_AGENTS.has(agent);
    const cloud =
      signed ||
      ["browser-use", "stagehand", "skyvern", "cdp-automation"].includes(agent);
    const cohort = cloud
      ? dcCohort(
          3,
          "agent",
          pick(r, DESKTOP_UAS)[0],
          lognormal(r, 0.8),
          20 + r() * 400,
        )
      : residential(
          3,
          "agent",
          pick(r, HUMAN_UAS.slice(0, 2))[0],
          lognormal(r, 0.8),
          200 + r() * 3000,
        );
    cohort.agent = agent;
    const verified = signed && r() < 0.9;
    const action = cfg.agentActions?.[agent];
    const blocked =
      action === "block" ||
      (action !== "allow" &&
        !(verified && cfg.allowVerifiedAgents) &&
        (cfg.blockAgents === "all" ||
          (cfg.blockAgents === "identified" && confidence === "high")));
    const f = {
      ...behaviorFields(
        [
          `agent:${agent}`,
          ...(r() < 0.5
            ? ["bh_warp_click", "bh_center_hit"]
            : ["bh_idle_then_act", "bh_warp_click"]),
        ],
        "agent",
        "agent",
      ),
      agent,
      agent_confidence: confidence,
      agent_verified: verified,
    };
    if (behaviorOn) f.verdict = "agent";
    const ch = challengePass(cohort);
    addTemplates(
      cohort,
      [
        [
          blocked
            ? [ch, redeem("block", { ...f, reason: "behavior_agent" })]
            : [ch, redeem("pass", f), verify()],
          0.9,
        ],
        [[ch], 0.07],
        [[ch, redeem("fail", { reason: "expired" })], 0.03],
      ],
      solveFor(cohort, [3400, 0.5]),
    );
  }

  for (let n = 0; n < 14; n++) {
    const twoCaptcha = r() < 0.35;
    const cohort =
      r() < 0.6
        ? dcCohort(
            4,
            "solver",
            pick(r, DESKTOP_UAS)[0],
            lognormal(r, 0.7),
            10 + r() * 200,
          )
        : residential(
            4,
            "solver",
            pick(r, DESKTOP_UAS)[0],
            lognormal(r, 0.7),
            400 + r() * 4000,
          );
    const flags = twoCaptcha
      ? ["agent:2captcha-solver", "bh_too_fast", "bh_warp_click"]
      : ["bh_polynomial_path", "bh_too_fast"];
    const f = {
      ...behaviorFields(flags, "solver", "automated"),
      ...(twoCaptcha && {
        agent: "2captcha-solver",
        agent_confidence: "high",
        agent_verified: false,
      }),
    };
    const ch = challengePass(cohort);
    addTemplates(
      cohort,
      [
        [
          blockBehavior || (twoCaptcha && cfg.blockAgents !== "off")
            ? [
                ch,
                redeem("block", {
                  ...f,
                  reason:
                    twoCaptcha && cfg.blockAgents !== "off"
                      ? "behavior_agent"
                      : "behavior_automated",
                }),
              ]
            : [ch, redeem("pass", scoreRule(f)), verify()],
          0.88,
        ],
        [[ch, redeem("fail", { reason: "invalid_solution" })], 0.06],
        [[limit], 0.06],
      ],
      solveFor(cohort, [520, 0.3]),
    );
  }

  if (rules.has("blocklist")) {
    const cohort = dcCohort(1, "blocked", pick(r, NON_BROWSER_UAS)[0], 1.4, 6);
    addTemplates(
      cohort,
      [
        [
          [
            {
              type: "challenge",
              outcome: "block",
              reason: `rule:${RULE_IDS.blocklist}`,
              rule: RULE_IDS.blocklist,
            },
          ],
          1,
        ],
      ],
      null,
    );
  }

  for (const t of templates) t.w /= profileWeights[t.p];
  const monthlyVisits = def.monthly;
  for (const c of cohorts) {
    const share = shares[PROFILES[c.p]] / profileWeights[c.p];
    if (c.p === 0)
      c.U = Math.min(
        POOL - 1,
        Math.max(40, Math.round((monthlyVisits * share * c.weight) / 3.2)),
      );
  }
  for (const t of templates) {
    t.events = t.events.map((e, i) => ({
      i,
      type: e.type,
      outcome: e.outcome,
      reason: e.reason ?? "",
      rule: e.rule ?? "",
      flags: e.flags ?? [],
      score: e.score ?? null,
      verdict: e.verdict ?? "",
      agent: e.agent ?? "",
      agent_confidence: e.agent_confidence ?? "",
      agent_verified: !!e.agent_verified,
      client: e.type !== "siteverify",
    }));
    const redeemEvent = t.events.find((e) => e.type === "redeem");
    for (const e of t.events) {
      if (e.type !== "siteverify" || !redeemEvent) continue;
      e.flags = redeemEvent.flags;
      e.score = redeemEvent.score;
      e.verdict = redeemEvent.verdict;
      e.agent = redeemEvent.agent;
      e.agent_confidence = redeemEvent.agent_confidence;
      e.agent_verified = redeemEvent.agent_verified;
    }
  }

  const base = PROFILES.map(
    (p) => (monthlyVisits * (shares[p] ?? 0)) / (30 * 24),
  );
  return {
    k,
    def,
    siteKey: def.siteKey,
    protocol: cfg.protocol ?? "hashwx",
    cohorts,
    templates,
    base,
    hours: new Map(),
  };
}

let built = null;
export const models = () => {
  built ??= SEED_KEYS.map(buildKey);
  return built;
};
export const modelFor = (siteKey) =>
  models().find((m) => m.siteKey === siteKey) ?? null;

let prefixIndex = null;
export const cohortsByPrefix = () => {
  if (prefixIndex) return prefixIndex;
  prefixIndex = new Map();
  for (const model of models())
    for (const c of model.cohorts) prefixIndex.set(`${c.a}.${c.b}`, [model, c]);
  return prefixIndex;
};

const BURST_PROFILE = { scraper: 1, stealth: 2, agent: 3, solver: 4 };

export function hourRate(model, p, h) {
  const key = h * 8 + p;
  const hit = model.hours.get(key);
  if (hit !== undefined) return hit;
  const k = model.k;
  const hod = ((h % 24) + 24) % 24;
  const day = Math.floor(h / 24);
  const dow = (day + 4) % 7;
  const human = weekShape(k, model.def.weekend)[dow * 24 + hod];

  let outage = 1;
  if (unit(h3(k, 0x0d, day)) < 0.02) {
    const start = Math.floor(unit(h3(k, 0x0e, day)) * 24);
    const length = 1 + Math.floor(unit(h3(k, 0x0f, day)) * 3);
    if (hod >= start && hod < start + length)
      outage = 0.06 + 0.25 * unit(h3(k, 0x10, h));
  }

  let rate;
  if (p === 0) {
    const date = new Date(h * HOUR);
    const holiday =
      (date.getUTCMonth() === 11 && date.getUTCDate() === 25) ||
      (date.getUTCMonth() === 0 && date.getUTCDate() === 1)
        ? 0.62
        : 1;
    rate =
      human *
      holiday *
      (0.86 + 0.28 * wobble(k, 0x11, h / 216)) *
      (0.92 + 0.16 * wobble(k, 0x12, h / 5)) *
      (0.93 + 0.14 * unit(h3(k, 0x13, day))) *
      (1 + 0.08 * (unit(h3(k, 0x14, h)) + unit(h3(k, 0x15, h)) - 1));
    for (let d = day - 1; d <= day; d++) {
      if (unit(h3(k, 0x21, d)) >= 0.07) continue;
      const since = h - (d * 24 + Math.floor(unit(h3(k, 0x22, d)) * 24));
      if (since < 0 || since > 14) continue;
      rate *= 1 + (0.4 + 1.5 * unit(h3(k, 0x23, d))) * Math.exp(-since / 3);
    }
  } else if (p === 3) {
    rate =
      (0.35 + 0.65 * human) *
      (1 + 0.25 * (2 * unit(h3(k, p, h)) - 1)) *
      (0.85 + 0.3 * wobble(k, 0x31, h / 40));
  } else {
    const c = CAMPAIGNS[p];
    const block = Math.floor(h / c.block);
    const level = 0.6 + 2.4 * unit(h3(k, p * 41 + 1, block)) ** 2;
    const on = unit(h3(k, p * 41, block)) < c.active;
    rate =
      ((on ? level : c.idle) * (1 + 0.25 * (2 * unit(h3(k, p, h)) - 1))) /
      (c.active * 1.4 + (1 - c.active) * c.idle);
    const name = PROFILES[p];
    const burst = model.def.bursts?.[name];
    if (burst && BURST_PROFILE[name] === p) {
      const [chance, maxHours, maxMult] = burst;
      if (unit(h3(k, p * 31 + 7, day)) < chance) {
        const start = Math.floor(unit(h3(k, p, day + 911)) * 22);
        const length =
          2 + Math.floor(unit(h3(k, p, day + 1733)) * (maxHours - 1));
        if (hod >= start && hod < start + length)
          rate *= 2.5 + unit(h3(k, p, day + 2741)) * (maxMult - 2.5);
      }
    }
  }
  const value = model.base[p] * rate * outage;
  model.hours.set(key, value);
  return value;
}

export function minuteRate(model, p, m) {
  const t = m / 60 - 0.5;
  const h0 = Math.floor(t);
  const f = t - h0;
  return (
    (hourRate(model, p, h0) * (1 - f) + hourRate(model, p, h0 + 1) * f) / 60
  );
}

export function visitCount(model, t, m, rates) {
  const lambda = rates[t.p] * t.w;
  return Math.floor(lambda + unit(h4(model.k, m, t.j, 0x51)));
}

export function visitAt(model, m, j, s) {
  const t = model.templates[j];
  const cohort = model.cohorts[t.c];
  const r = prng(h4(model.k, m, j, s + 1));
  const t0 = m * MIN + Math.floor(r() * MIN);
  const idx = Math.floor(r() * cohort.U);
  const redeemEvent = t.events.find((e) => e.type === "redeem");
  const score =
    redeemEvent?.score != null ? sampleScore(redeemEvent.score, r) : null;
  const solve = t.solve ? Math.min(30_000, sampleSolve(t.solve, r)) : null;
  const d1 = (solve ?? 900) + 200 + Math.floor(r() * 2600);
  const d2 = 150 + Math.floor(r() * 1500);
  const times = t.events.map((e) =>
    e.type === "challenge" ? t0 : e.type === "redeem" ? t0 + d1 : t0 + d1 + d2,
  );
  return { model, m, j, s, t, cohort, idx, score, solve, times };
}

export const quickIdx = (model, m, j, s) => {
  const t = model.templates[j];
  const r = prng(h4(model.k, m, j, s + 1));
  r();
  return Math.floor(r() * model.cohorts[t.c].U);
};

export function materialize(v, e) {
  const { model, t, cohort } = v;
  const ev = t.events[e];
  const token = encodeVisit(model.k, v.m, v.j, v.s);
  const ts = v.times[e];
  const client = ev.client;
  const hasToken = ev.type !== "challenge";
  return {
    id: encodeEventId(ts, token, e),
    ts,
    site_key: model.siteKey,
    type: ev.type,
    outcome: ev.outcome,
    reason: ev.reason || null,
    ip: client ? ipOf(cohort, v.idx) : null,
    country: client ? cohort.country || null : null,
    asn: client ? cohort.asn || null : null,
    asn_org: client ? cohort.org || null : null,
    ua: client ? cohort.ua || null : null,
    browser: client ? cohort.browser || null : null,
    os: client ? cohort.os || null : null,
    platform: client ? cohort.platform || null : null,
    origin: cohort.origin || null,
    lang: client ? cohort.lang || null : null,
    fp: client ? encodeFp(model.k, cohort.i, v.idx) : null,
    protocol: model.protocol,
    solve_ms: ev.type === "redeem" ? v.solve : null,
    score: ev.type === "challenge" ? null : ev.score != null ? v.score : null,
    verdict: ev.verdict || null,
    agent: ev.agent || null,
    agent_confidence: ev.agent_confidence || null,
    agent_verified: ev.agent_verified,
    flags: ev.flags,
    rule: ev.rule || null,
    token_id: hasToken ? token : null,
  };
}
