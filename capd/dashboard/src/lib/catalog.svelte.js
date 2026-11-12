import { api } from "./api.js";

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

const REASONS = {
  invalid_solution: "Wrong proof-of-work answer",
  invalid_solutions: "Malformed solutions",
  invalid_token: "Invalid challenge token",
  expired: "Challenge expired",
  already_redeemed: "Challenge reused",
  scope_mismatch: "Token from another key",
  rate_limited: "Rate limited",
  non_browser_ua: "Non-browser user agent",
  missing_header: "Missing required header",
  behavior_automated: "Interaction looked automated",
  behavior_agent: "AI agent blocked",
  behavior_missing: "No interaction trace",
  behavior_no_interaction: "Solved without interacting",
  instr_automated_browser: "Automated browser",
  instr_automated_interaction: "Script-dispatched clicks or keys",
  instr_failed: "Browser check failed",
  instr_missing: "Browser check missing",
  instr_timeout: "Browser check timed out",
  instr_corrupted: "Browser check tampered with",
  instr_widget_outdated: "Widget too old for this key",
  instr_isolated: "Isolated page can't meet this key",
  instr_csp_blocked: "Page CSP blocked the browser check",
  instr_natives_tampered: "Browser functions patched before the check",
  instr_env_failed: "Browser environment check failed",
  instr_script_failed: "Browser check script crashed",
  instr_host_unreachable: "Browser check couldn't read the page",
  instr_probe_missing: "Browser probe missing",
  instr_expired: "Browser check expired",
  instr_stale: "Browser check result too old",
  instr_oversized: "Browser check result too large",
  instr_wasm_available: "Asked for SHA-256 with WebAssembly available",
  failed_challenge: "Wrong browser check answer",
  token_not_found: "Unknown or used token",
  token_expired: "Token expired",
};

export function reasonLabel(r) {
  if (!r) return "";
  if (r.startsWith("rule:")) return `Rule ${r.slice(5)}`;
  if (r.startsWith("allowed:")) return `Allowed by ${r.slice(8)}`;
  if (r.startsWith("signal:")) return `Signal ${r.slice(7)}`;
  if (r.startsWith("harder_x")) return `Puzzle ×${r.slice(8)}`;
  return REASONS[r] ?? r;
}
