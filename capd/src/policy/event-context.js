import { getPublicSettings, getQueries } from "../events/index.js";
import { listLists, matchList } from "./lists.js";
import { eventContext } from "./preview.js";
import { getRules, ruleHits } from "./rules.js";

const DAY = 86_400_000;

const pick = (s) =>
  s && {
    total: s.total,
    blocked: s.blocked,
    limited: s.limited,
    failed: s.failed,
    solved: s.solved,
    flagged: s.flagged,
    ips: s.ips,
    visitors: s.clients,
  };

async function footprint(queries, siteKey, from, to, field, value) {
  if (value == null || value === "") return null;
  const ctx = { siteKey, from, to, filters: [{ field, value: String(value) }] };
  const [summary, bounds] = await Promise.all([
    queries.summary(ctx),
    queries.bounds(ctx),
  ]);
  if (!summary.total) return null;
  return { ...pick(summary), first: bounds.first, last: bounds.last };
}

export async function eventContextDetail(siteKey, id, { scoped = false } = {}) {
  const queries = getQueries();
  const event = await queries.get(siteKey, id);
  if (!event) return null;
  const to = Date.now() + 60_000;
  const from = to - (getPublicSettings().retentionDays || 30) * DAY;
  const week = to - 7 * DAY;
  const ctx = eventContext(event);
  const stage = event.type === "challenge" ? "challenge" : "redeem";
  const [ip, network, visitor, keyWeek, ipKeys, lists, rules] =
    await Promise.all([
      footprint(queries, siteKey, from, to, "ip", event.ip),
      event.asn
        ? footprint(queries, siteKey, week, to, "asn", event.asn)
        : null,
      footprint(queries, siteKey, from, to, "fp", event.fp),
      event.asn ? queries.summary({ siteKey, from: week, to }) : null,
      event.ip && !scoped
        ? queries.bounds({
            from,
            to,
            filters: [{ field: "ip", value: event.ip }],
          })
        : null,
      scoped ? [] : listLists(),
      getRules(siteKey),
    ]);
  const onLists = [];
  for (const list of lists) {
    const match = await matchList(list.id, ctx);
    if (match) {
      const i = match.indexOf(":");
      onLists.push({
        id: list.id,
        name: list.name,
        kind: match.slice(0, i),
        value: match.slice(i + 1),
      });
    }
  }
  const matching = [];
  if (event.type === "challenge" || event.type === "redeem") {
    for (const rule of rules) {
      if (stage === "challenge" && !rule.requestOnly) continue;
      if (!(await ruleHits(rule, ctx))) continue;
      matching.push({
        id: rule.id,
        name: rule.name,
        action: rule.action,
        enabled: rule.enabled,
      });
    }
  }
  return {
    ip: ip && { ...ip, ...(ipKeys && { keys: ipKeys.keys }) },
    network: network && {
      ...network,
      asn: event.asn,
      asn_org: event.asn_org,
      share: keyWeek?.total ? network.total / keyWeek.total : null,
    },
    visitor,
    lists: onLists,
    rules: matching,
    window: { from, to, networkFrom: week },
  };
}
