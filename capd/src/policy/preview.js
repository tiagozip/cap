import { resolveRange } from "../events/analytics.js";
import { getPublicSettings, getQueries, getStore } from "../events/index.js";
import { compileRules, getRules, RULE_FIELDS, ruleHits } from "./rules.js";

const SAMPLING = { windows: 12, perWindow: 250 };
const D1_SAMPLING = { windows: 4, perWindow: 750 };
const EXAMPLES = 5;
const TOP = 5;
const UNSEEN_FIELDS = new Set(["header", "ip_velocity", "visitor_velocity"]);
const TOP_FIELDS = ["ip", "country", "asn_org"];

export const eventContext = (e) => ({
  ...e,
  asn: e.asn ?? 0,
  flags: (e.flags ?? []).filter((f) => !f.startsWith("rule:")),
  headers: null,
});

const newCounter = () => ({
  matched: 0,
  decided: 0,
  stages: { challenge: 0, redeem: 0 },
  outcomes: { pass: 0, fail: 0, block: 0, limit: 0 },
  changes: { blocked: 0, unblocked: 0 },
  estimate: { matched: 0, blocked: 0, unblocked: 0 },
  ips: new Set(),
  visitors: new Set(),
  top: Object.fromEntries(TOP_FIELDS.map((f) => [f, new Map()])),
  examples: [],
});

const tally = (map, value) => {
  if (value == null || value === "") return;
  map.set(value, (map.get(value) ?? 0) + 1);
};

const topOf = (map) =>
  [...map]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .map(([value, n]) => ({ value, n }));

const wouldBlock = (e) => e.outcome !== "block" && e.outcome !== "limit";

const stageOf = (e) => {
  if (e.type === "redeem") return "redeem";
  if (e.type === "challenge" && e.outcome !== "pass") return "challenge";
  return null;
};

async function simulate(compiled, sample) {
  const perRule = new Map(compiled.map((r) => [r.id, newCounter()]));
  const totals = {
    events: 0,
    block: 0,
    allow: 0,
    flag: 0,
    harder: 0,
    blocked: 0,
    unblocked: 0,
  };
  for (const [e, w] of sample) {
    const stage = stageOf(e);
    if (!stage) continue;
    totals.events += w;
    const ctx = eventContext(e);
    const lifted = e.outcome === "block" && e.reason !== "rate_limited";
    let action = null;
    let flagged = false;
    let harder = false;
    for (const rule of compiled) {
      if (stage === "challenge" && !rule.requestOnly) continue;
      if (!(await ruleHits(rule, ctx))) continue;
      const c = perRule.get(rule.id);
      c.matched++;
      c.estimate.matched += w;
      c.stages[stage]++;
      if (c.outcomes[e.outcome] != null) c.outcomes[e.outcome]++;
      if (e.ip) c.ips.add(e.ip);
      if (e.fp) c.visitors.add(e.fp);
      for (const f of TOP_FIELDS) tally(c.top[f], e[f]);
      if (c.examples.length < EXAMPLES) c.examples.push(e);
      if (action || !rule.enabled) continue;
      c.decided++;
      if (rule.action === "flag") {
        flagged = true;
        continue;
      }
      if (rule.action === "harder") {
        harder = true;
        continue;
      }
      action = rule.action;
      if (action === "block" && wouldBlock(e)) {
        c.changes.blocked++;
        c.estimate.blocked += w;
      }
      if (action === "allow" && lifted) {
        c.changes.unblocked++;
        c.estimate.unblocked += w;
      }
    }
    if (action === "block") totals.block += w;
    if (action === "allow") totals.allow += w;
    if (flagged) totals.flag += w;
    if (harder) totals.harder += w;
    if (action === "block" && wouldBlock(e)) totals.blocked += w;
    const ruleBlocked = e.outcome === "block" && e.reason?.startsWith("rule:");
    if ((action === "allow" && lifted) || (ruleBlocked && action !== "block"))
      totals.unblocked += w;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return { perRule, totals };
}

const present = (rule, c) => ({
  id: rule.id,
  name: rule.name,
  action: rule.action,
  enabled: rule.enabled,
  stage: rule.requestOnly ? "challenge" : "redeem",
  unseen: [
    ...new Set(
      rule.conditions
        .map((x) => x.field)
        .filter((f) => UNSEEN_FIELDS.has(f) && RULE_FIELDS[f]),
    ),
  ],
  matched: c.matched,
  decided: c.decided,
  stages: c.stages,
  outcomes: c.outcomes,
  changes: c.changes,
  estimate: {
    matched: Math.round(c.estimate.matched),
    blocked: Math.round(c.estimate.blocked),
    unblocked: Math.round(c.estimate.unblocked),
  },
  ips: c.ips.size,
  visitors: c.visitors.size,
  top: Object.fromEntries(TOP_FIELDS.map((f) => [f, topOf(c.top[f])])),
  examples: c.examples,
});

const STOPPED = [
  { field: "type", value: "challenge" },
  { field: "outcome", value: "block" },
  { field: "outcome", value: "limit" },
];
const REDEEMS = [{ field: "type", value: "redeem" }];

async function sampleWindow(queries, ctx, perWindow) {
  const [redeems, stopped] = await Promise.all([
    queries.list({ ...ctx, filters: REDEEMS }, { limit: perWindow }),
    queries.list({ ...ctx, filters: STOPPED }, { limit: perWindow }),
  ]);
  let weights = { redeem: 1, stopped: 1 };
  if (redeems.next || stopped.next) {
    const flow = await queries.flow(ctx);
    const count = (pick) =>
      flow.filter(pick).reduce((sum, row) => sum + row.n, 0);
    const all = {
      redeem: count((row) => row.type === "redeem"),
      stopped: count(
        (row) => row.type === "challenge" && row.outcome !== "pass",
      ),
    };
    weights = {
      redeem: redeems.events.length
        ? Math.max(1, all.redeem / redeems.events.length)
        : 1,
      stopped: stopped.events.length
        ? Math.max(1, all.stopped / stopped.events.length)
        : 1,
    };
  }
  return [
    ...redeems.events.map((e) => [e, weights.redeem]),
    ...stopped.events.map((e) => [e, weights.stopped]),
  ];
}

export async function previewRules(siteKey, rules, { range } = {}) {
  const r = resolveRange({ range: range ?? "24h" });
  const queries = getQueries();
  const { windows: count, perWindow } =
    getStore()?.kind === "d1" ? D1_SAMPLING : SAMPLING;
  const span = Math.ceil((r.to - r.from) / count);
  const [draft, saved, ...windows] = await Promise.all([
    compileRules(rules),
    getRules(siteKey),
    ...Array.from({ length: count }, (_, i) =>
      sampleWindow(
        queries,
        {
          siteKey,
          from: r.from + i * span,
          to: Math.min(r.to, r.from + (i + 1) * span),
        },
        perWindow,
      ),
    ),
  ]);
  const sample = windows.flat().sort((a, b) => b[0].ts - a[0].ts);
  const [draftRun, savedRun] = await Promise.all([
    simulate(draft, sample),
    simulate(saved, sample),
  ]);
  return {
    range: { from: r.from, to: r.to },
    sampled: sample.length,
    estimated: sample.some(([, w]) => w > 1),
    ipMasked: getPublicSettings().ipMode !== "full",
    rules: draft.map((rule) => present(rule, draftRun.perRule.get(rule.id))),
    totals: { draft: draftRun.totals, saved: savedRun.totals },
  };
}
