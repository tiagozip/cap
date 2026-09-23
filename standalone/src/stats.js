import { db, hgetall } from "./db.js";

const day = 86400;

const hourlyFields = (start, end) => {
  const fields = [];
  for (let b = Math.floor(start / 3600) * 3600; b < end; b += 3600) {
    fields.push(String(b));
  }
  return fields;
};

const fetchMetrics = (keys, fields) => {
  if (!fields) return Promise.all(keys.map((key) => hgetall(key)));
  if (!fields.length) return Promise.resolve(keys.map(() => ({})));
  return Promise.all(
    keys.map(async (key) => {
      const values = await db.hmget(key, fields);
      const hash = {};
      for (let i = 0; i < fields.length; i++) {
        if (values?.[i] != null) hash[fields[i]] = values[i];
      }
      return hash;
    }),
  );
};

const sumRange = (hash, start, end) => {
  let s = 0;
  for (const [b, v] of Object.entries(hash)) {
    const bn = Number(b);
    if (bn >= start && (end === undefined || bn < end)) s += Number(v);
  }
  return s;
};

const aggregateDaily = (hash, start, end) => {
  const m = new Map();
  for (const [b, v] of Object.entries(hash)) {
    const bn = Number(b);
    if (bn >= start && (end === undefined || bn < end)) {
      const dayB = Math.floor(bn / day) * day;
      m.set(dayB, (m.get(dayB) || 0) + Number(v));
    }
  }
  return m;
};

export const chartDurations = [
  "today",
  "yesterday",
  "last7days",
  "last28days",
  "last91days",
  "alltime",
];

export async function keyStats(sk, chartDuration = "today") {
  const now = Math.floor(Date.now() / 1000);

  let bucketSize, startTime, endTime;
  switch (chartDuration) {
    case "today":
      bucketSize = 3600;
      startTime = Math.floor(now / day) * day;
      endTime = Math.floor(now / 3600) * 3600 + 3600;
      break;
    case "yesterday":
      bucketSize = 3600;
      startTime = Math.floor(now / day) * day - day;
      endTime = startTime + day;
      break;
    case "last7days":
      bucketSize = day;
      startTime = Math.floor((now - 7 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      break;
    case "last28days":
      bucketSize = day;
      startTime = Math.floor((now - 28 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      break;
    case "last91days":
      bucketSize = day;
      startTime = Math.floor((now - 91 * day) / day) * day;
      endTime = Math.floor(now / day) * day + day;
      break;
    case "alltime":
      bucketSize = day;
      startTime = 0;
      endTime = now + day;
      break;
    default:
      bucketSize = 3600;
      startTime = now - day;
      endTime = now + 3600;
  }

  const periodLen = endTime - startTime;
  let prevStartTime = null,
    prevEndTime = null;
  if (chartDuration !== "alltime") {
    prevEndTime = startTime;
    prevStartTime = startTime - periodLen;
  }

  const [verifiedH, failedH, ratelimitedH, latSumH, latCountH] =
    await fetchMetrics(
      [
        `metrics:verified:${sk}`,
        `metrics:failed:${sk}`,
        `metrics:ratelimited:${sk}`,
        `metrics:latency_sum:${sk}`,
        `metrics:latency_count:${sk}`,
      ],
      bucketSize === 3600
        ? hourlyFields(prevStartTime ?? startTime, endTime)
        : null,
    );

  const chartData = [];
  if (bucketSize === day) {
    const veM = aggregateDaily(verifiedH, startTime, endTime);
    const faM = aggregateDaily(failedH, startTime, endTime);
    const rlM = aggregateDaily(ratelimitedH, startTime, endTime);

    const numDays =
      chartDuration === "last7days"
        ? 7
        : chartDuration === "last28days"
          ? 28
          : chartDuration === "last91days"
            ? 91
            : undefined;
    if (numDays) {
      const currentDayStart = Math.floor(now / day) * day;
      for (let i = 0; i < numDays; i++) {
        const b = currentDayStart - (numDays - 1 - i) * day;
        const verified = veM.get(b) || 0;
        const failed = faM.get(b) || 0;
        chartData.push({
          bucket: b,
          challenges: verified + failed,
          verified,
          failed,
          rateLimited: rlM.get(b) || 0,
        });
      }
    } else {
      const allBuckets = new Set([...veM.keys(), ...faM.keys(), ...rlM.keys()]);
      for (const b of [...allBuckets].sort((a, c) => a - c)) {
        const verified = veM.get(b) || 0;
        const failed = faM.get(b) || 0;
        chartData.push({
          bucket: b,
          challenges: verified + failed,
          verified,
          failed,
          rateLimited: rlM.get(b) || 0,
        });
      }
    }
  } else {
    const startHour = Math.floor(startTime / 3600);
    const endHour = Math.floor((endTime - 1) / 3600);
    for (let h = startHour; h <= endHour; h++) {
      const b = h * 3600;
      const bs = String(b);
      const verified = Number(verifiedH[bs] || 0);
      const failed = Number(failedH[bs] || 0);
      chartData.push({
        bucket: b,
        challenges: verified + failed,
        verified,
        failed,
        rateLimited: Number(ratelimitedH[bs] || 0),
      });
    }
  }

  const totalVerified = sumRange(verifiedH, startTime, endTime);
  const totalFailed = sumRange(failedH, startTime, endTime);
  const totalRateLimited = sumRange(ratelimitedH, startTime, endTime);
  const totalLatSum = sumRange(latSumH, startTime, endTime);
  const totalLatCount = sumRange(latCountH, startTime, endTime);
  const avgLatency =
    totalLatCount > 0 ? Math.round(totalLatSum / totalLatCount) : 0;

  let prevStats = null;
  if (prevStartTime !== null) {
    const pVerified = sumRange(verifiedH, prevStartTime, prevEndTime);
    const pFailed = sumRange(failedH, prevStartTime, prevEndTime);
    const pRateLimited = sumRange(ratelimitedH, prevStartTime, prevEndTime);
    const pLatSum = sumRange(latSumH, prevStartTime, prevEndTime);
    const pLatCount = sumRange(latCountH, prevStartTime, prevEndTime);
    prevStats = {
      challenges: pVerified + pFailed,
      verified: pVerified,
      failed: pFailed,
      avgLatency: pLatCount > 0 ? Math.round(pLatSum / pLatCount) : 0,
      rateLimited: pRateLimited,
    };
  }

  return {
    stats: {
      challenges: totalVerified + totalFailed,
      verified: totalVerified,
      failed: totalFailed,
      avgLatency,
      rateLimited: totalRateLimited,
    },
    prevStats,
    chartData: {
      duration: chartDuration,
      bucketSize,
      data: chartData,
    },
  };
}

export async function geoStats(sk) {
  const [countryData, asnData, platformData, osData] = await Promise.all([
    hgetall(`metrics:country:${sk}`),
    hgetall(`metrics:asn:${sk}`),
    hgetall(`metrics:platform:${sk}`),
    hgetall(`metrics:os:${sk}`),
  ]);

  const countries = Object.entries(countryData)
    .map(([code, count]) => ({ code, count: Number(count) }))
    .sort((a, b) => b.count - a.count);
  const asns = Object.entries(asnData)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);
  const platforms = Object.entries(platformData)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);
  const oses = Object.entries(osData)
    .map(([name, count]) => ({ name, count: Number(count) }))
    .sort((a, b) => b.count - a.count);

  return {
    countries,
    totalCountry: countries.reduce((s, c) => s + c.count, 0),
    asns,
    totalAsn: asns.reduce((s, a) => s + a.count, 0),
    platforms,
    totalPlatform: platforms.reduce((s, p) => s + p.count, 0),
    oses,
    totalOs: oses.reduce((s, o) => s + o.count, 0),
  };
}
