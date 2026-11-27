import { api } from "./api.js";

export { reasonLabel } from "../../../src/policy/reasons.js";

export const catalog = $state({
  loaded: false,
  fields: {},
  ops: {},
  actions: [],
  signals: [],
  agents: [],
  signedAgents: [],
  risk: { weights: {}, weakCap: 0.6, threshold: 0.75 },
  webhookTriggers: [],
  webhookDigests: [],
  webhookMinCounts: [],
  webhookServices: [],
});

let pending;
export function loadCatalog() {
  pending ??= api("GET", "/policy/catalog").then((c) => {
    if (c?.error) {
      pending = null;
      return catalog;
    }
    Object.assign(catalog, c, { loaded: true });
    return catalog;
  });
  return pending;
}

export const agentName = (id) =>
  catalog.agents.find(([a]) => a === id)?.[1] ?? id;

export function signalInfo(flag) {
  for (const g of catalog.signals) {
    const s = g.signals.find(([id]) => id === flag);
    if (s) return { id: s[0], text: s[1], strength: s[2], group: g.label };
  }
  if (flag.startsWith("agent:"))
    return {
      id: flag,
      text: `AI agent: ${agentName(flag.slice(6))}`,
      group: "AI agents",
    };
  if (flag.startsWith("rule:"))
    return { id: flag, text: `Matched rule ${flag.slice(5)}`, group: "Rules" };
  return { id: flag, text: flag };
}

export const OUTCOMES = {
  pass: { label: "Passed", icon: "check" },
  fail: { label: "Failed", icon: "x" },
  block: { label: "Blocked", icon: "ban" },
  limit: { label: "Rate limited", icon: "clock" },
};

export const EVENT_TYPES = {
  challenge: "Challenge",
  redeem: "Redeem",
  siteverify: "Siteverify",
};
