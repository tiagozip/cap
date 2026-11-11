import {
  agentName,
  EVENT_TYPES,
  OUTCOMES,
  reasonLabel,
  signalInfo,
} from "../../lib/catalog.svelte.js";
import { countryName, languageName } from "../../lib/geo.js";
import { t, tp } from "../../lib/i18n.svelte.js";

export const countryFlag = (code) =>
  /^[a-z]{2}$/i.test(code ?? "")
    ? String.fromCodePoint(
        ...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)),
      )
    : "";

export const FILTER_LABELS = {
  get type() {
    return t("Event");
  },
  get outcome() {
    return t("Outcome");
  },
  get reason() {
    return t("Reason");
  },
  get ip() {
    return t("IP");
  },
  get country() {
    return t("Country");
  },
  get asn() {
    return t("Network number");
  },
  get asn_org() {
    return t("Network");
  },
  get browser() {
    return t("Browser");
  },
  get os() {
    return t("System");
  },
  get platform() {
    return t("Device");
  },
  get origin() {
    return t("Website");
  },
  get lang() {
    return t("Language");
  },
  get fp() {
    return t("Visitor");
  },
  get verdict() {
    return t("Verdict");
  },
  get agent() {
    return t("AI agent");
  },
  get rule() {
    return t("Rule");
  },
  get flag() {
    return t("Signal");
  },
  get token_id() {
    return t("Token");
  },
  get protocol() {
    return t("Protocol");
  },
  get agent_confidence() {
    return t("Agent confidence");
  },
};

export const verdictLabel = (v) => {
  if (!v) return "";
  if (v === "ok") return "OK";
  const map = {
    suspicious: "Suspicious",
    automated: "Automated",
    agent: "Agent",
    no_interaction: "No interaction",
    missing: "Missing",
  };
  return map[v] ? t(map[v]) : `${v.charAt(0).toUpperCase()}${v.slice(1)}`;
};

export const filterValueLabel = (field, value) => {
  if (field === "country") return countryName(value.toUpperCase());
  if (field === "outcome")
    return value === "flagged"
      ? t("Flagged")
      : (OUTCOMES[value]?.label ?? value);
  if (field === "type") return EVENT_TYPES[value] ?? value;
  if (field === "reason") return reasonLabel(value);
  if (field === "agent") return agentName(value);
  if (field === "flag") return signalInfo(value).text;
  if (field === "asn") return `AS${value}`;
  if (field === "lang") return languageName(value);
  if (field === "platform") return t(value);
  if (field === "verdict") return verdictLabel(value);
  return value;
};

export const splitFilter = (f) => {
  const neg = f.startsWith("-");
  const body = neg ? f.slice(1) : f;
  const i = body.indexOf(":");
  return { neg, field: body.slice(0, i), value: body.slice(i + 1) };
};

const HARMLESS = new Set([
  "expired",
  "already_redeemed",
  "token_expired",
  "token_not_found",
  "instr_timeout",
]);
export const failKind = (e) =>
  e.outcome === "fail" && e.reason && !HARMLESS.has(e.reason)
    ? "failBad"
    : "fail";

export const isFlagged = (e) =>
  e.type === "redeem" && e.outcome === "pass" && !!e.flags?.length;

const lowerFirst = (s) =>
  /^[A-Z][a-z]/.test(s) ? `${s[0].toLowerCase()}${s.slice(1)}` : s;

export function eventSentence(e) {
  if (e.outcome === "pass") {
    const base =
      e.type === "challenge"
        ? t("Challenge issued")
        : e.type === "siteverify"
          ? t("Token checked by your server")
          : t("Solved the challenge");
    if (e.agent)
      return t("{base} by {agent}", { base, agent: agentName(e.agent) });
    const n = e.flags?.length ?? 0;
    if (n)
      return tp(
        n,
        "{base} with {count} risk signal",
        "{base} with {count} risk signals",
        { base },
      );
    return base;
  }
  if (e.outcome === "limit") return t("Sent too many requests");
  const label = OUTCOMES[e.outcome]?.label ?? e.outcome;
  if (!e.reason || e.reason === "rate_limited") return label;
  return t("{label}: {reason}", {
    label,
    reason: lowerFirst(reasonLabel(e.reason)),
  });
}

export const TTL_OPTIONS = [
  [0, "Never"],
  [3600, "1 hour"],
  [86400, "1 day"],
  [604800, "7 days"],
  [2592000, "30 days"],
];

export const CHALLENGE_TTL = 15 * 60_000;
const ORDER = { challenge: 0, redeem: 1, siteverify: 2 };
const WORST = ["block", "limit", "fail", "flagged", "pass"];
const isIssued = (x) => x.type === "challenge" && x.outcome === "pass";

export function groupSolves(
  rows,
  settled = Date.now() - CHALLENGE_TTL,
  before = [],
) {
  const groups = [];
  const byToken = new Map();
  const waiting = before
    .filter((x) => x.type === "redeem")
    .map((x) => ({ before: true, events: [x] }));
  for (const e of rows) {
    if (e.token_id && e.type !== "challenge") {
      const known = byToken.get(e.token_id);
      const g = known ?? { id: e.id, ts: e.ts, events: [] };
      g.events.push(e);
      if (!known) {
        byToken.set(e.token_id, g);
        groups.push(g);
      }
      if (e.type === "redeem") waiting.push(g);
      continue;
    }
    if (isIssued(e)) {
      const at = waiting.findIndex((g) => {
        const r = g.events.find((x) => x.type === "redeem");
        return (
          r.ip === e.ip &&
          r.fp === e.fp &&
          r.ts >= e.ts &&
          r.ts - e.ts < CHALLENGE_TTL
        );
      });
      if (at >= 0) {
        if (!waiting[at].before) waiting[at].events.push(e);
        waiting.splice(at, 1);
        continue;
      }
    }
    groups.push({ id: e.id, ts: e.ts, events: [e] });
  }
  return groups.map((g) => {
    const events = g.events.toSorted(
      (a, b) => ORDER[a.type] - ORDER[b.type] || a.ts - b.ts,
    );
    const redeem = events.find((e) => e.type === "redeem");
    const verify = events.find((e) => e.type === "siteverify");
    const main = redeem ?? events.at(-1);
    const state = (e) => (isFlagged(e) ? "flagged" : e.outcome);
    return {
      ...g,
      timedOut: events.every(isIssued) && g.ts < settled,
      events,
      main,
      client: events.find((e) => e.type !== "siteverify") ?? main,
      decision:
        WORST.find((w) => events.some((e) => state(e) === w)) ?? main.outcome,
      title:
        redeem?.outcome === "pass"
          ? verify
            ? verify.outcome === "pass"
              ? t("Solved and verified")
              : t("Solved, verify failed")
            : t("Solved")
          : redeem
            ? t("Solve failed")
            : t("Token verified"),
    };
  });
}
