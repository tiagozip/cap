import { api } from "./api.js";
import { t } from "./i18n.svelte.js";

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

export const fieldLabel = (id) => t(catalog.fields[id]?.label ?? id);

export function signalInfo(flag) {
  for (const g of catalog.signals) {
    const s = g.signals.find(([id]) => id === flag);
    if (s)
      return { id: s[0], text: t(s[1]), strength: s[2], group: t(g.label) };
  }
  if (flag.startsWith("agent:"))
    return {
      id: flag,
      text: t("AI agent: {name}", { name: agentName(flag.slice(6)) }),
      group: t("AI agents"),
    };
  if (flag.startsWith("rule:"))
    return {
      id: flag,
      text: t("Matched rule {id}", { id: flag.slice(5) }),
      group: t("Rules"),
    };
  return { id: flag, text: flag };
}

export const OUTCOMES = {
  pass: {
    get label() {
      return t("Passed");
    },
    icon: "check",
  },
  fail: {
    get label() {
      return t("Failed");
    },
    icon: "x",
  },
  block: {
    get label() {
      return t("Blocked");
    },
    icon: "ban",
  },
  limit: {
    get label() {
      return t("Rate limited");
    },
    icon: "clock",
  },
};

export const EVENT_TYPES = {
  get challenge() {
    return t("Challenge");
  },
  get redeem() {
    return t("Redeem");
  },
  get siteverify() {
    return t("Siteverify");
  },
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
  failed_challenge: "Wrong browser check answer",
  token_not_found: "Unknown or used token",
  token_expired: "Token expired",
};

export function reasonLabel(r) {
  if (!r) return "";
  if (r.startsWith("rule:")) return t("Rule {id}", { id: r.slice(5) });
  if (r.startsWith("allowed:")) return t("Allowed by {id}", { id: r.slice(8) });
  if (r.startsWith("signal:")) return t("Signal {id}", { id: r.slice(7) });
  if (r.startsWith("harder_x"))
    return t("Puzzle ×{factor}", { factor: r.slice(8) });
  return REASONS[r] ? t(REASONS[r]) : r;
}
