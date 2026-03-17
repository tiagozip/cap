const DEMO_KEYS = [
  {
    siteKey: "a1b2c3d4e5",
    name: "production-web",
    created: Date.now() - 90 * 86400000,
    traffic: 2_800_000,
    failRate: 0.06,
    config: {
      difficulty: 4,
      challengeCount: 80,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 5,
      blockAutomatedBrowsers: true,
      ratelimitMax: null,
      ratelimitDuration: null,
      corsOrigins: ["example.com", "www.example.com"],
      blockNonBrowserUA: true,
      requiredHeaders: ["accept-language", "sec-ch-ua"],
    },
  },
  {
    siteKey: "f6g7h8i9j0",
    name: "mobile-app",
    created: Date.now() - 75 * 86400000,
    traffic: 420_000,
    failRate: 0.04,
    config: {
      difficulty: 3,
      challengeCount: 50,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 3,
      blockAutomatedBrowsers: false,
      ratelimitMax: 50,
      ratelimitDuration: 10000,
      corsOrigins: null,
      blockNonBrowserUA: false,
      requiredHeaders: null,
    },
  },
  {
    siteKey: "k1l2m3n4o5",
    name: "checkout-flow",
    created: Date.now() - 60 * 86400000,
    traffic: 890_000,
    failRate: 0.09,
    config: {
      difficulty: 5,
      challengeCount: 120,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 7,
      blockAutomatedBrowsers: true,
      ratelimitMax: 20,
      ratelimitDuration: 5000,
      corsOrigins: ["shop.example.com"],
      blockNonBrowserUA: true,
      requiredHeaders: ["accept-language", "sec-ch-ua", "sec-ch-ua-platform"],
    },
  },
  {
    siteKey: "p6q7r8s9t0",
    name: "api-gateway",
    created: Date.now() - 45 * 86400000,
    traffic: 3_500_000,
    failRate: 0.14,
    config: {
      difficulty: 4,
      challengeCount: 80,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 4,
      blockAutomatedBrowsers: true,
      ratelimitMax: 100,
      ratelimitDuration: 5000,
      corsOrigins: null,
      blockNonBrowserUA: false,
      requiredHeaders: null,
    },
  },
  {
    siteKey: "u1v2w3x4y5",
    name: "staging",
    created: Date.now() - 30 * 86400000,
    traffic: 1_200,
    failRate: 0.02,
    config: {
      difficulty: 2,
      challengeCount: 30,
      saltSize: 32,
      instrumentation: false,
      obfuscationLevel: 1,
      blockAutomatedBrowsers: false,
      ratelimitMax: null,
      ratelimitDuration: null,
      corsOrigins: null,
      blockNonBrowserUA: false,
      requiredHeaders: null,
    },
  },
  {
    siteKey: "z6a7b8c9d0",
    name: "partner-portal",
    created: Date.now() - 55 * 86400000,
    traffic: 165_000,
    failRate: 0.07,
    config: {
      difficulty: 4,
      challengeCount: 80,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 5,
      blockAutomatedBrowsers: false,
      ratelimitMax: null,
      ratelimitDuration: null,
      corsOrigins: ["partners.example.com"],
      blockNonBrowserUA: true,
      requiredHeaders: ["accept-language"],
    },
  },
  {
    siteKey: "e1f2g3h4i5",
    name: "marketing-site",
    created: Date.now() - 20 * 86400000,
    traffic: 310_000,
    failRate: 0.05,
    config: {
      difficulty: 3,
      challengeCount: 60,
      saltSize: 32,
      instrumentation: true,
      obfuscationLevel: 3,
      blockAutomatedBrowsers: false,
      ratelimitMax: null,
      ratelimitDuration: null,
      corsOrigins: null,
      blockNonBrowserUA: false,
      requiredHeaders: null,
    },
  },
];

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COUNTRY_WEIGHTS = [
  ["US", 28], ["GB", 9], ["DE", 7], ["PT", 6], ["FR", 5], ["CA", 4], ["AU", 3.5],
  ["NL", 3], ["BR", 2.8], ["IN", 2.5], ["JP", 2.2], ["KR", 1.8], ["ES", 1.7],
  ["IT", 1.5], ["PL", 1.4], ["SE", 1.2], ["MX", 1.1], ["RU", 1.0], ["ID", 0.9],
  ["TR", 0.8], ["CH", 0.7], ["AT", 0.6], ["BE", 0.6], ["NO", 0.5], ["DK", 0.5],
  ["FI", 0.5], ["PT", 0.5], ["IE", 0.5], ["CZ", 0.4], ["RO", 0.4], ["SG", 0.4],
  ["IL", 0.4], ["NZ", 0.3], ["TH", 0.3], ["PH", 0.3], ["UA", 0.3], ["AR", 0.3],
  ["CO", 0.2], ["ZA", 0.2], ["HK", 0.2], ["TW", 0.2], ["CL", 0.2], ["AE", 0.2],
  ["VN", 0.2], ["MY", 0.2], ["NG", 0.15], ["EG", 0.1], ["SA", 0.1], ["PK", 0.1],
];

const ASN_POOL = [
  // residential
  { name: "AS7922 Comcast Cable Communications", weight: 8, type: "residential" },
  { name: "AS7018 AT&T Services", weight: 7, type: "residential" },
  { name: "AS20001 Charter Communications", weight: 5, type: "residential" },
  { name: "AS22773 Cox Communications", weight: 3, type: "residential" },
  { name: "AS701 Verizon Business", weight: 4, type: "residential" },
  { name: "AS3320 Deutsche Telekom AG", weight: 4, type: "residential" },
  { name: "AS12322 Free SAS", weight: 2.5, type: "residential" },
  { name: "AS3209 Vodafone GmbH", weight: 3, type: "residential" },
  { name: "AS5089 Virgin Media Limited", weight: 2, type: "residential" },
  { name: "AS2856 British Telecommunications PLC", weight: 2.5, type: "residential" },
  { name: "AS3215 Orange S.A.", weight: 3, type: "residential" },
  { name: "AS6805 Telefonica Germany", weight: 2, type: "residential" },
  { name: "AS8151 UNINET", weight: 1.5, type: "residential" },
  { name: "AS4804 Microplex PTY LTD", weight: 1, type: "residential" },
  { name: "AS36375 Umich", weight: 0.5, type: "residential" },
  { name: "AS5650 Frontier Communications", weight: 1.5, type: "residential" },
  { name: "AS34984 Superonline Iletisim Hizmetleri", weight: 1, type: "residential" },
  { name: "AS6167 Verizon Business", weight: 2, type: "residential" },
  { name: "AS3269 Telecom Italia", weight: 1.5, type: "residential" },
  { name: "AS1136 KPN", weight: 1.5, type: "residential" },
  // mobile
  { name: "AS21928 T-Mobile USA", weight: 5, type: "mobile" },
  { name: "AS16591 Google Fiber", weight: 1, type: "mobile" },
  { name: "AS6128 Cablevision Systems", weight: 1, type: "residential" },
  // datacenter
  { name: "AS13335 Cloudflare, Inc.", weight: 4, type: "datacenter" },
  { name: "AS60068 Datacamp Limited", weight: 2.5, type: "datacenter" },
  { name: "AS14061 DigitalOcean, LLC", weight: 2, type: "datacenter" },
  { name: "AS16509 Amazon.com, Inc.", weight: 3, type: "datacenter" },
  { name: "AS24940 Hetzner Online GmbH", weight: 2, type: "datacenter" },
  { name: "AS15169 Google LLC", weight: 2, type: "datacenter" },
  { name: "AS8075 Microsoft Corporation", weight: 1.5, type: "datacenter" },
  { name: "AS396982 Google Cloud", weight: 1, type: "datacenter" },
  { name: "AS63949 Linode, LLC", weight: 1, type: "datacenter" },
  { name: "AS20473 The Constant Company, LLC", weight: 1, type: "datacenter" },
  { name: "AS51167 Contabo GmbH", weight: 0.8, type: "datacenter" },
  { name: "AS16276 OVH SAS", weight: 1.5, type: "datacenter" },
];

const BLOCKED_RULES = [
  { type: "ip", value: "45.134.26.171", permanent: true },
  { type: "ip", value: "185.220.101.34", permanent: false, expiresIn: 86400000 },
  { type: "cidr", value: "192.42.116.0/22", permanent: true },
  { type: "asn", value: "AS60068 Datacamp Limited", permanent: true },
  { type: "country", value: "RU", permanent: false, expiresIn: 604800000 },
  { type: "ip", value: "91.242.217.95", permanent: true },
  { type: "cidr", value: "2a06:98c0::/29", permanent: true },
  { type: "ip", value: "103.152.220.44", permanent: false, expiresIn: 3600000 },
];

function generateCountryStats(rng, totalChallenges) {
  const totalWeight = COUNTRY_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const countries = [];

  for (const [code, weight] of COUNTRY_WEIGHTS) {
    const base = (weight / totalWeight) * totalChallenges;
    const jitter = 1 + (rng() - 0.5) * 0.4;
    const count = Math.max(1, Math.round(base * jitter));
    countries.push({ code, count });
  }

  countries.sort((a, b) => b.count - a.count);
  return countries;
}

function generateASNStats(rng, totalChallenges) {
  const totalWeight = ASN_POOL.reduce((s, a) => s + a.weight, 0);
  const asns = [];

  for (const asn of ASN_POOL) {
    const base = (asn.weight / totalWeight) * totalChallenges;
    const jitter = 1 + (rng() - 0.5) * 0.5;
    const count = Math.max(1, Math.round(base * jitter));
    asns.push({ name: asn.name, count });
  }

  asns.sort((a, b) => b.count - a.count);
  return asns;
}

function generateChartData(rng, key, duration) {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  const hour = 3600;
  const totalTraffic = key.traffic;

  let bucketSize, startTime, endTime, numBuckets;
  switch (duration) {
    case "today":
      bucketSize = hour;
      startTime = Math.floor(now / day) * day;
      endTime = Math.floor(now / hour) * hour + hour;
      numBuckets = Math.ceil((endTime - startTime) / hour);
      break;
    case "yesterday":
      bucketSize = hour;
      startTime = Math.floor(now / day) * day - day;
      endTime = startTime + day;
      numBuckets = 24;
      break;
    case "last7days":
      bucketSize = day;
      startTime = Math.floor((now - 7 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      numBuckets = 7;
      break;
    case "last28days":
      bucketSize = day;
      startTime = Math.floor((now - 28 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      numBuckets = 28;
      break;
    case "last91days":
      bucketSize = day;
      startTime = Math.floor((now - 91 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      numBuckets = 91;
      break;
    case "alltime": {
      const daysOld = Math.ceil((Date.now() - key.created) / 86400000);
      bucketSize = day;
      numBuckets = daysOld;
      startTime = Math.floor(now / day) * day - (daysOld - 1) * day;
      endTime = Math.floor(now / day) * day + day;
      break;
    }
    default:
      bucketSize = hour;
      startTime = now - day;
      endTime = now + hour;
      numBuckets = 24;
  }

  const dailyTraffic = totalTraffic / 91;
  const data = [];

  let totalChallenges = 0;
  let totalVerified = 0;
  let totalLatSum = 0;
  let totalLatCount = 0;
  let totalRateLimited = 0;

  for (let i = 0; i < numBuckets; i++) {
    const bucket = startTime + i * bucketSize;

    let multiplier = 1;
    if (bucketSize === hour) {
      const hourOfDay = Math.floor((bucket % day) / hour);
      multiplier = 0.3 + 0.7 * Math.max(0, Math.sin(((hourOfDay - 4) / 24) * Math.PI * 2) * 0.5 + 0.5);
    }

    const age = (bucket - startTime) / (endTime - startTime);
    const trendMul = 0.7 + 0.3 * age;

    const base = (dailyTraffic / (bucketSize === hour ? 24 : 1)) * multiplier * trendMul;
    const jitter = 1 + (rng() - 0.5) * 0.3;
    const challenges = Math.max(0, Math.round(base * jitter));
    const failRate = key.failRate * (1 + (rng() - 0.5) * 0.6);
    const verified = Math.max(0, Math.round(challenges * (1 - failRate)));
    const rateLimited = Math.round(challenges * (0.005 + rng() * 0.015));
    const avgLatency = Math.round(2000 + rng() * 6000);

    totalChallenges += challenges;
    totalVerified += verified;
    totalRateLimited += rateLimited;
    if (challenges > 0) {
      totalLatSum += avgLatency * challenges;
      totalLatCount += challenges;
    }

    data.push({ bucket, challenges, verified, rateLimited });
  }

  return {
    stats: {
      challenges: totalChallenges,
      verified: totalVerified,
      rateLimited: totalRateLimited,
      avgLatency: totalLatCount > 0 ? Math.round(totalLatSum / totalLatCount) : 0,
    },
    chartData: {
      duration,
      bucketSize,
      data,
    },
  };
}

function generateBlockedIps(rng, siteKey) {
  const keyIdx = DEMO_KEYS.findIndex((k) => k.siteKey === siteKey);
  if (keyIdx > 3) return [];

  const numRules = Math.min(BLOCKED_RULES.length, 2 + Math.floor(rng() * (BLOCKED_RULES.length - 2)));
  const rules = [];
  const used = new Set();

  for (let i = 0; i < numRules; i++) {
    let idx;
    do {
      idx = Math.floor(rng() * BLOCKED_RULES.length);
    } while (used.has(idx));
    used.add(idx);

    const rule = BLOCKED_RULES[idx];
    const permanent = rule.permanent;
    const expires = permanent ? null : Date.now() + rule.expiresIn;

    rules.push({
      ip: rule.value,
      type: rule.type,
      permanent,
      expires,
    });
  }

  return rules;
}

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

export function demoGetKeys() {
  return DEMO_KEYS.map((key) => {
    const rng = mulberry32(hashStr(key.siteKey + "24h"));
    const dailyTraffic = key.traffic / 91;
    const current = Math.round(dailyTraffic * (0.8 + rng() * 0.4));
    const previous = Math.round(dailyTraffic * (0.8 + rng() * 0.4));

    let change = 0;
    let direction = "";
    if (previous > 0) {
      change = ((current - previous) / previous) * 100;
      direction = current > previous ? "up" : current < previous ? "down" : "";
    } else if (current > 0) {
      change = 100;
      direction = "up";
    }

    return {
      siteKey: key.siteKey,
      name: key.name,
      created: key.created,
      solvesLast24h: current,
      difference: { value: change.toFixed(2), direction },
    };
  });
}

export function demoGetKey(siteKey, chartDuration = "today") {
  const key = DEMO_KEYS.find((k) => k.siteKey === siteKey);
  if (!key) return null;

  const rng = mulberry32(hashStr(siteKey + chartDuration));
  const { stats, chartData } = generateChartData(rng, key, chartDuration);

  let prevStats = null;
  if (chartDuration !== "alltime") {
    const prevRng = mulberry32(hashStr(siteKey + chartDuration + "prev"));
    prevStats = {
      challenges: Math.round(stats.challenges * (0.7 + prevRng() * 0.6)),
      verified: Math.round(stats.verified * (0.7 + prevRng() * 0.6)),
      avgLatency: Math.round(stats.avgLatency * (0.8 + prevRng() * 0.4)),
      rateLimited: Math.round(stats.rateLimited * (0.5 + prevRng() * 1.0)),
    };
  }

  return {
    key: {
      siteKey: key.siteKey,
      name: key.name,
      created: key.created,
      config: { ...key.config },
    },
    stats,
    prevStats,
    chartData,
  };
}

const PLATFORM_WEIGHTS = [
  ["Desktop", 62], ["Phone", 33], ["Tablet", 5],
];
const OS_WEIGHTS = [
  ["Windows", 38], ["macOS", 18], ["iOS", 16], ["Android", 17], ["Linux", 8], ["iPadOS", 3],
];

function generateWeightedStats(rng, total, weights) {
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0);
  const items = [];
  for (const [name, weight] of weights) {
    const base = (weight / totalWeight) * total;
    const jitter = 1 + (rng() - 0.5) * 0.4;
    const count = Math.max(1, Math.round(base * jitter));
    items.push({ name, count });
  }
  items.sort((a, b) => b.count - a.count);
  return items;
}

export function demoGetGeoStats(siteKey) {
  const key = DEMO_KEYS.find((k) => k.siteKey === siteKey);
  if (!key) return null;

  const rng = mulberry32(hashStr(siteKey + "geo"));
  const countries = generateCountryStats(rng, key.traffic);
  const totalCountry = countries.reduce((s, c) => s + c.count, 0);

  const asnRng = mulberry32(hashStr(siteKey + "asn"));
  const asns = generateASNStats(asnRng, key.traffic);
  const totalAsn = asns.reduce((s, a) => s + a.count, 0);

  const platRng = mulberry32(hashStr(siteKey + "platform"));
  const platforms = generateWeightedStats(platRng, key.traffic, PLATFORM_WEIGHTS);
  const totalPlatform = platforms.reduce((s, p) => s + p.count, 0);

  const osRng = mulberry32(hashStr(siteKey + "os"));
  const oses = generateWeightedStats(osRng, key.traffic, OS_WEIGHTS);
  const totalOs = oses.reduce((s, o) => s + o.count, 0);

  return { countries, totalCountry, asns, totalAsn, platforms, totalPlatform, oses, totalOs };
}

export function demoGetBlockedIps(siteKey) {
  const rng = mulberry32(hashStr(siteKey + "blocked"));
  return generateBlockedIps(rng, siteKey);
}

function hashStr(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}
