const SCRIPTED = [
  "interaction_synthetic_clicks",
  "interaction_synthetic_keydowns",
];

export function blocks(f, e, signedAgents) {
  const flags = e.flags ?? [];
  if (flags.some((x) => f.signals[x] === "block")) return true;
  if (f.scripted === "block" && flags.some((x) => SCRIPTED.includes(x)))
    return true;
  if (e.agent) {
    const trusted = e.agent_verified || !signedAgents.includes(e.agent);
    const override = trusted
      ? (f.agentActions[e.agent] ?? f.agentActions["*"])
      : undefined;
    if (override) {
      if (override === "block") return true;
    } else if (
      !(f.signedAgents && e.agent_verified) &&
      (f.agents === "all" ||
        (f.agents === "identified" && e.agent_confidence === "high"))
    )
      return true;
  }
  return (
    f.behavior === "block" && e.score != null && e.score >= Number(f.threshold)
  );
}

export function policyDiff(sample, before, after, signedAgents) {
  let more = 0;
  let fewer = 0;
  let total = 0;
  for (const w of sample.windows) {
    total += w.total;
    const n = w.events.length;
    if (!n) continue;
    let m = 0;
    let l = 0;
    for (const e of w.events) {
      const a = blocks(before, e, signedAgents);
      const b = blocks(after, e, signedAgents);
      if (b && !a) m++;
      else if (a && !b) l++;
    }
    more += (m / n) * w.total;
    fewer += (l / n) * w.total;
  }
  return { more: Math.round(more), fewer: Math.round(fewer), total };
}
