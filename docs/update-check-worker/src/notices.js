const REPO = "tiagozip/cap";
const TTL = 3600;
const CAPD_PACKAGE = /^(capd|tiago2\/cap)$|standalone/i;

const parts = (v) => {
  const [core, pre] = String(v).trim().replace(/^v/, "").split("-");
  const nums = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return { nums: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], pre: pre ?? null };
};

export const compare = (a, b) => {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
};

export const inRange = (version, range) => {
  const clauses = String(range ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every((c) => {
    const m = c.match(/^(<=|>=|<|>|=|≤|≥)?\s*v?(\d[\w.-]*)$/);
    if (!m) return false;
    const d = compare(version, m[2]);
    const op = { "≤": "<=", "≥": ">=" }[m[1]] ?? m[1] ?? "=";
    if (op === "<") return d < 0;
    if (op === "<=") return d <= 0;
    if (op === ">") return d > 0;
    if (op === ">=") return d >= 0;
    return d === 0;
  });
};

async function github(env, ctx, path) {
  const cache = caches.default;
  const key = new Request(`https://updates.internal/github${path}`);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "cap-update-check",
      ...(env.GITHUB_TOKEN && { authorization: `Bearer ${env.GITHUB_TOKEN}` }),
    },
  });
  if (!r.ok) throw new Error(`GitHub responded with ${r.status}`);
  const data = await r.json();
  ctx.waitUntil(
    cache.put(
      key,
      new Response(JSON.stringify(data), {
        headers: { "Cache-Control": `public, max-age=${TTL}` },
      }),
    ),
  );
  return data;
}

async function latestCapd(env, ctx) {
  const releases = await github(env, ctx, "/releases?per_page=50");
  const r = releases.find((x) => !x.draft && !x.prerelease && x.tag_name?.startsWith("capd@"));
  return r ? { version: r.tag_name.slice(5), url: r.html_url } : null;
}

async function advisoriesFor(env, ctx, version) {
  const list = await github(env, ctx, "/security-advisories?per_page=100&state=published");
  return list
    .filter((a) =>
      a.vulnerabilities?.some(
        (v) => CAPD_PACKAGE.test(v.package?.name ?? "") && inRange(version, v.vulnerable_version_range),
      ),
    )
    .map((a) => ({
      id: a.ghsa_id,
      summary: a.summary,
      severity: a.severity || "unknown",
      url: a.html_url,
      fixedIn:
        a.vulnerabilities.find((v) => CAPD_PACKAGE.test(v.package?.name ?? ""))?.patched_versions || null,
    }));
}

export async function noticesFor(env, ctx, version) {
  const [latest, advisories] = await Promise.all([
    latestCapd(env, ctx).catch(() => null),
    advisoriesFor(env, ctx, version).catch(() => []),
  ]);
  return {
    latest: latest && compare(latest.version, version) > 0 ? latest : null,
    advisories,
  };
}
