import { agentName, fieldLabel } from "../../lib/catalog.svelte.js";
import { t } from "../../lib/i18n.svelte.js";

const OPS_EN = {
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

export const OP_LABELS = Object.fromEntries(
  Object.keys(OPS_EN).map((k) => [k, undefined]),
);
for (const [k, en] of Object.entries(OPS_EN)) {
  Object.defineProperty(OP_LABELS, k, {
    enumerable: true,
    get: () => t(en),
  });
}

export const NO_VALUE_OPS = ["exists", "not_exists", "is_true", "is_false"];

export const ACTION_LABELS = {
  get block() {
    return t("Block");
  },
  get allow() {
    return t("Allow");
  },
  get flag() {
    return t("Flag");
  },
  get harder() {
    return t("Harder puzzle");
  },
};

export const ACTION_TONES = {
  block: "danger",
  allow: "success",
  flag: "warning",
  harder: "brand",
};

export const ACTION_HELP = {
  get block() {
    return t(
      "Cap rejects the request. A rule that only looks at the request stops the puzzle from loading at all.",
    );
  },
  get allow() {
    return t(
      "Cap lets the visitor through and skips every rule and automatic block after this one.",
    );
  },
  get flag() {
    return t(
      "Cap lets the visitor through and adds this rule to the risk flags your server gets back from siteverify.",
    );
  },
  get harder() {
    return t("Cap gives the visitor a puzzle that takes longer to solve.");
  },
};

export const TEMPLATES = [
  {
    get name() {
      return t("Harder puzzles for fast repeat visitors");
    },
    action: "harder",
    factor: 4,
    match: "all",
    conditions: [{ field: "ip_velocity", op: "gt", value: 20 }],
  },
  {
    get name() {
      return t("Block headless browsers");
    },
    action: "block",
    match: "any",
    conditions: [
      { field: "browser", op: "eq", value: "HeadlessChrome" },
      { field: "ua", op: "contains", value: "headless" },
    ],
  },
  {
    get name() {
      return t("Flag suspicious interaction");
    },
    action: "flag",
    match: "all",
    conditions: [{ field: "score", op: "gte", value: 0.4 }],
  },
  {
    get name() {
      return t("Block unverified AI agents");
    },
    action: "block",
    match: "all",
    conditions: [
      { field: "agent", op: "neq", value: "" },
      { field: "agent_verified", op: "is_false" },
    ],
  },
  {
    get name() {
      return t("Block requests without a browser fetch header");
    },
    action: "block",
    match: "all",
    conditions: [
      { field: "header", header: "sec-fetch-site", op: "not_exists" },
    ],
  },
];

export const TRIGGER_LABELS = {
  get block() {
    return t("Blocked requests");
  },
  get fail() {
    return t("Failed solves");
  },
  get flagged() {
    return t("Solves with risk flags");
  },
  get agent() {
    return t("AI agents");
  },
  get rule() {
    return t("Rule matches");
  },
  get all() {
    return t("Every event");
  },
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

export function conditionText(c, lists) {
  if (c.field === "agent" && c.op === "neq" && !c.value)
    return t("an AI agent was detected");
  if (c.field === "list" && (c.op === "in_list" || c.op === "not_in_list"))
    return c.op === "in_list"
      ? t("the visitor is on the {list} list", {
          list: lists.find((l) => l.id === c.value)?.name ?? c.value,
        })
      : t("the visitor is not on the {list} list", {
          list: lists.find((l) => l.id === c.value)?.name ?? c.value,
        });
  const name =
    c.field === "header"
      ? t("the {header} header", { header: c.header })
      : lowerFirst(fieldLabel(c.field));
  let value = c.value;
  if (c.field === "list")
    value = lists.find((l) => l.id === c.value)?.name ?? c.value;
  else if (c.field === "agent")
    value = c.value ? agentName(c.value) : t("any agent");
  else if (Array.isArray(value)) value = value.join(", ");
  return `${name} ${OP_LABELS[c.op] ?? c.op}${value != null && value !== "" ? ` ${value}` : ""}`;
}

export const ruleSentence = (r, lists) => {
  const verb =
    r.action === "harder"
      ? t("Make the puzzle {factor}× harder", { factor: r.factor ?? 2 })
      : ACTION_LABELS[r.action];
  const joined = r.conditions
    .map((c) => conditionText(c, lists))
    .join(r.match === "any" ? ` ${t("or")} ` : ` ${t("and")} `);
  return t("{verb} when {conditions}", { verb, conditions: joined });
};

export function conditionParts(c, lists) {
  if (c.field === "agent" && c.op === "neq" && !c.value)
    return { field: t("AI agent"), op: OP_LABELS.exists };
  const field =
    c.field === "header"
      ? t("{header} header", { header: c.header })
      : fieldLabel(c.field);
  const op = OP_LABELS[c.op] ?? c.op;
  if (NO_VALUE_OPS.includes(c.op)) return { field, op };
  let value = c.value;
  if (c.field === "list")
    value = lists.find((l) => l.id === c.value)?.name ?? c.value;
  else if (c.field === "agent")
    value = c.value ? agentName(c.value) : t("any agent");
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
