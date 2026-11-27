import { agentName, catalog } from "../../lib/catalog.svelte.js";

export const OP_LABELS = {
  eq: "is",
  neq: "is not",
  in: "is one of",
  not_in: "is not one of",
  contains: "contains",
  not_contains: "doesn't contain",
  starts_with: "starts with",
  matches: "matches regex",
  gt: "is more than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  exists: "is present",
  not_exists: "is missing",
  in_list: "is on list",
  not_in_list: "is not on list",
  has: "includes",
  not_has: "doesn't include",
  is_true: "is yes",
  is_false: "is no",
};

export const NO_VALUE_OPS = ["exists", "not_exists", "is_true", "is_false"];

export const ACTION_LABELS = {
  block: "Block",
  allow: "Allow",
  flag: "Flag",
  harder: "Harder puzzle",
};

export const ACTION_TONES = {
  block: "danger",
  allow: "success",
  flag: "warning",
  harder: "brand",
};

export const ACTION_HELP = {
  block:
    "Rejects the request. Rules that only check the request stop the puzzle from loading.",
  allow: "Lets the visitor through and skips later rules and automatic blocks.",
  flag: "Lets the visitor through and adds this rule to the risk flags siteverify returns.",
  harder: "Gives the visitor a puzzle that takes longer to solve.",
};

export const TEMPLATES = [
  {
    name: "Harder puzzles for fast repeat visitors",
    action: "harder",
    factor: 4,
    match: "all",
    conditions: [{ field: "ip_velocity", op: "gt", value: 20 }],
  },
  {
    name: "Block headless browsers",
    action: "block",
    match: "any",
    conditions: [
      { field: "browser", op: "eq", value: "HeadlessChrome" },
      { field: "ua", op: "contains", value: "headless" },
    ],
  },
  {
    name: "Flag suspicious interaction",
    action: "flag",
    match: "all",
    conditions: [{ field: "score", op: "gte", value: 0.4 }],
  },
  {
    name: "Block unverified AI agents",
    action: "block",
    match: "all",
    conditions: [
      { field: "flag", op: "has", value: "agent:*" },
      { field: "agent_verified", op: "is_false" },
    ],
  },
  {
    name: "Block requests without a browser fetch header",
    action: "block",
    match: "all",
    conditions: [
      { field: "header", header: "sec-fetch-site", op: "not_exists" },
    ],
  },
];

export const TRIGGER_LABELS = {
  block: "Blocked requests",
  fail: "Failed solves",
  flagged: "Solves with risk flags",
  agent: "AI agents",
  rule: "Rule matches",
  all: "Every event",
};

export const VERDICTS = [
  "ok",
  "suspicious",
  "automated",
  "agent",
  "no_interaction",
  "missing",
];

const lowerFirst = (s) =>
  /^[A-Z][a-z]/.test(s) ? `${s[0].toLowerCase()}${s.slice(1)}` : s;

const anyAgent = (c) =>
  (c.field === "agent" && c.op === "neq" && !c.value) ||
  (c.field === "flag" && c.op === "has" && c.value === "agent:*");

export function conditionText(c, lists) {
  if (anyAgent(c)) return "an AI agent was detected";
  if (c.field === "list" && (c.op === "in_list" || c.op === "not_in_list"))
    return `the visitor is ${c.op === "in_list" ? "on" : "not on"} the ${lists.find((l) => l.id === c.value)?.name ?? c.value} list`;
  const f = catalog.fields[c.field];
  const name =
    c.field === "header"
      ? `the ${c.header} header`
      : lowerFirst(f?.label ?? c.field);
  let value = c.value;
  if (c.field === "list")
    value = lists.find((l) => l.id === c.value)?.name ?? c.value;
  else if (c.field === "agent")
    value = c.value ? agentName(c.value) : "any agent";
  else if (Array.isArray(value)) value = value.join(", ");
  return `${name} ${OP_LABELS[c.op] ?? c.op}${value != null && value !== "" ? ` ${value}` : ""}`;
}

export const ruleSentence = (r, lists) => {
  const verb =
    r.action === "harder"
      ? `Make the puzzle ${r.factor ?? 2}× harder`
      : ACTION_LABELS[r.action];
  const joined = r.conditions
    .map((c) => conditionText(c, lists))
    .join(r.match === "any" ? " or " : " and ");
  return `${verb} when ${joined}`;
};

export function conditionParts(c, lists) {
  if (anyAgent(c)) return { field: "AI agent", op: "is present" };
  if (c.field === "list" && (c.op === "in_list" || c.op === "not_in_list"))
    return {
      field: "Visitor",
      op: c.op === "in_list" ? "is on" : "isn't on",
      value: lists.find((l) => l.id === c.value)?.name ?? c.value,
    };
  const f = catalog.fields[c.field];
  const field =
    c.field === "header" ? `${c.header} header` : (f?.label ?? c.field);
  const op = OP_LABELS[c.op] ?? c.op;
  if (NO_VALUE_OPS.includes(c.op)) return { field, op };
  let value = c.value;
  if (c.field === "list")
    value = lists.find((l) => l.id === c.value)?.name ?? c.value;
  else if (c.field === "agent")
    value = c.value ? agentName(c.value) : "any agent";
  else if (Array.isArray(value)) value = value.join(", ");
  return {
    field,
    op,
    value: value == null || value === "" ? null : String(value),
    mono: ["ip", "ua", "header", "visitor"].includes(c.field),
  };
}

export const actionLabel = (r) =>
  r.action === "harder"
    ? `${ACTION_LABELS.harder} ×${r.factor ?? 2}`
    : ACTION_LABELS[r.action];
