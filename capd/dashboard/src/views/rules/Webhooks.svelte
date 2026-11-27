<script>
import { tick } from "svelte";
import { REASONS } from "../../../../src/policy/reasons.js";
import { formatMessage } from "../../../../src/policy/webhook-services.js";
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import {
  Button,
  CodeBlock,
  CopyText,
  Dialog,
  Empty,
  Field,
  Group,
  Icon,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  Select,
  Spinner,
  Switch,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { agentIconId } from "../../lib/agents.js";
import { api } from "../../lib/api.js";
import { catalog } from "../../lib/catalog.svelte.js";
import { ago } from "../../lib/format.js";
import { countryNames, flagUrl } from "../../lib/geo.js";
import { app } from "../../lib/state.svelte.js";
import { confirm, toast, undoable } from "../../lib/ui.svelte.js";
import ConditionPicker from "../../polish/lists-hooks/ConditionPicker.svelte";
import DeliveryLog from "../../polish/lists-hooks/DeliveryLog.svelte";
import HealthStrip from "../../polish/lists-hooks/HealthStrip.svelte";
import MessagePreview from "../../polish/lists-hooks/MessagePreview.svelte";
import MultiPick from "../../polish/lists-hooks/MultiPick.svelte";
import ServiceIcon from "../../polish/lists-hooks/ServiceIcon.svelte";
import { highlight } from "../integration/highlight.js";
import { ACTION_LABELS, TRIGGER_LABELS } from "./rules.js";

let {
  siteKey = null,
  scope = "key",
  hooks = $bindable([]),
  onchange,
} = $props();

const instance = $derived(scope === "instance");
const groupId = $derived(instance ? "settings-webhooks-title" : "webhooks");
const base = $derived(
  instance ? "/settings/webhooks" : `/keys/${siteKey}/webhooks`,
);

let adding = $state(null);
let secret = $state(null);
let log = $state(null);
let history = $state({});
let testing = $state({});
let tested = $state(null);
let fresh = $state(null);
let eventView = $state(null);
let picker = $state(false);
let rules = $state(null);
let samples = $state(null);

const DIGEST_LABELS = {
  0: "Each event as it happens",
  60: "One summary a minute",
  300: "One summary every 5 minutes",
  900: "One summary every 15 minutes",
  3600: "One summary an hour",
};

const MIN_LABELS = {
  0: "Whenever something matched",
  5: "When at least 5 events matched",
  10: "When at least 10 events matched",
  25: "When at least 25 events matched",
  50: "When at least 50 events matched",
  100: "When at least 100 events matched",
  500: "When at least 500 events matched",
};
const WHERE = [
  ["any", "Anywhere"],
  ["only", "Only from these countries"],
  ["except", "Anywhere except these countries"],
];

const noFilters = () => ({
  rules: [],
  flags: [],
  agents: [],
  reasons: [],
  countries: [],
  score: 0.75,
});

const ruleOptions = $derived(
  (rules ?? []).map((r) => ({
    value: r.id,
    label: r.name || r.id,
    hint: [ACTION_LABELS[r.action], r.enabled === false ? "Off" : ""]
      .filter(Boolean)
      .join(", "),
  })),
);
const flagOptions = $derived(
  catalog.signals.flatMap((g) =>
    g.signals.map(([id, text]) => ({ value: id, label: text, group: g.label })),
  ),
);
const agentOptions = $derived(
  catalog.agents.map(([id, name]) => ({ value: id, label: name })),
);
const reasonOptions = Object.entries(REASONS).map(([value, label]) => ({
  value,
  label,
  hint: value,
}));
const countryOptions = Object.entries(countryNames)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label));

const SCOPES = {
  rule: {
    key: "rules",
    any: "Any rule",
    noun: ["rule", "rules"],
    empty: "This key has no rules yet",
  },
  flagged: { key: "flags", any: "Any risk flag", noun: ["flag", "flags"] },
  agent: { key: "agents", any: "Any AI agent", noun: ["agent", "agents"] },
  reason: { key: "reasons", any: "Any reason", noun: ["reason", "reasons"] },
};
const scopeOptions = (t) =>
  ({
    rule: ruleOptions,
    flagged: flagOptions,
    agent: agentOptions,
    reason: reasonOptions,
  })[t];

function loadRules() {
  if (rules || instance) return;
  api("GET", `/keys/${siteKey}/rules`).then((r) => {
    rules = Array.isArray(r) ? r : [];
  });
}

const services = $derived(
  catalog.webhookServices.length
    ? catalog.webhookServices
    : [
        {
          id: "generic",
          name: "Webhook",
          blurb: "Signed JSON to your own endpoint",
          fields: [],
        },
      ],
);
const serviceOf = (id) => services.find((s) => s.id === id) ?? services[0];
const available = $derived(
  instance ? catalog.webhookInstanceTriggers : catalog.webhookTriggers,
);

async function openEvent(id) {
  const { default: Component } = await import("../events/EventDrawer.svelte");
  eventView = { Component, id, hook: log?.hook, open: true };
}

function closeEvent() {
  if (!eventView?.open) return;
  const { hook } = eventView;
  eventView.open = false;
  setTimeout(() => {
    if (!log && hook) showLog(hook);
  }, 220);
}

$effect(() => {
  const ids = hooks.map((h) => h.id);
  let stale = false;
  const refresh = () =>
    Promise.all(
      ids.map((id) =>
        api("GET", `${base}/${id}/deliveries`).then((l) => [
          id,
          Array.isArray(l) ? l : undefined,
        ]),
      ),
    ).then((pairs) => {
      if (stale) return;
      const next = Object.fromEntries(pairs);
      for (const id of ids)
        if (next[id] === undefined && history[id]) next[id] = history[id];
      history = next;
      if (log && next[log.hook.id]) log.rows = next[log.hook.id];
    });
  refresh();
  const timer = setInterval(() => {
    if (document.visibilityState === "visible" && ids.length) refresh();
  }, 30_000);
  return () => {
    stale = true;
    clearInterval(timer);
  };
});

$effect(() => {
  const preset = app.webhookPreset;
  if (!preset) return;
  const { scope: target = "key", ...rest } = preset;
  if (target !== scope) return;
  app.webhookPreset = null;
  startAdd(rest);
  tick().then(() =>
    document
      .getElementById(groupId)
      ?.scrollIntoView({ block: "start", behavior: "smooth" }),
  );
});

const VERIFY = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(header, rawBody, secret) {
  const { t, v1 = "" } = Object.fromEntries(
    header.split(",").map((part) => part.split("=")),
  );
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 300) return false;
  const mac = createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  return (
    v1.length === mac.length &&
    timingSafeEqual(Buffer.from(v1), Buffer.from(mac))
  );
}
`;

const title = (h) => h.name || h.label || h.url;

const defaults = (service) =>
  Object.fromEntries(
    serviceOf(service).fields.map((f) => [f.key, f.value ?? ""]),
  );

function startAdd(preset = {}) {
  adding = {
    id: null,
    service: "generic",
    url: "",
    name: "",
    triggers: instance ? ["login_failed", "security"] : ["block"],
    digest: 0,
    config: {},
    secrets: {},
    headers: [],
    min: 0,
    where: "any",
    error: "",
    field: "",
    busy: false,
    ...preset,
    filters: { ...noFilters(), ...preset.filters },
  };
  adding.config = { ...defaults(adding.service), ...adding.config };
  samples = null;
  loadRules();
}

const startEdit = (h) => {
  adding = {
    id: h.id,
    service: h.service ?? "generic",
    url: h.url ?? "",
    name: h.name ?? "",
    triggers: [...h.triggers],
    digest: h.digest ?? 0,
    config: { ...defaults(h.service ?? "generic"), ...h.config },
    secrets: { ...h.secrets },
    headers: (h.headers ?? []).map((x) => ({ ...x, saved: true })),
    min: h.min ?? 0,
    where: h.filters?.countries?.length
      ? h.filters.exceptCountries
        ? "except"
        : "only"
      : "any",
    filters: { ...noFilters(), ...h.filters },
    original: h.service ?? "generic",
    error: "",
    field: "",
    busy: false,
  };
  samples = null;
  loadRules();
};

function pickService(id) {
  if (adding.service === id) return;
  const saved =
    adding.original === id ? hooks.find((h) => h.id === adding.id) : null;
  adding.service = id;
  adding.config = { ...defaults(id), ...saved?.config };
  adding.secrets = { ...saved?.secrets };
  adding.error = "";
  adding.field = "";
  tick().then(() =>
    document.querySelector("#hookForm input:not([type=checkbox])")?.focus(),
  );
}

const urlProblem = (raw) => {
  const v = raw.trim();
  if (!v) return "Enter the URL Cap should send events to";
  let u;
  try {
    u = new URL(v);
  } catch {
    return /^[a-z][\w+.-]*:/i.test(v)
      ? "Enter a valid URL"
      : "Start the URL with https://";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return "Webhooks must use http or https";
  if (u.username || u.password)
    return "Put credentials in a header, not the URL";
  return "";
};

const digesting = $derived(!instance && !!Number(adding?.digest));

const ruleNames = $derived(
  Object.fromEntries((rules ?? []).map((r) => [r.id, r.name || r.id])),
);

const previewOptions = $derived.by(() => {
  if (!adding) return [];
  return digesting ? ["digest", ...adding.triggers] : adding.triggers;
});
const previewShown = $derived.by(() => {
  const picked = (samples ?? []).filter((t) => previewOptions.includes(t));
  return picked.length ? picked : previewOptions.slice(0, 1);
});
const toggleSample = (t, on) => {
  const next = on ? [...previewShown, t] : previewShown.filter((x) => x !== t);
  samples = previewOptions.filter((x) => next.includes(x));
};

function sampleEvent(t, i = 0) {
  const f = adding.filters;
  const picked = adding.where === "only" && f.countries[i % f.countries.length];
  const country =
    picked ||
    ["DE", "US", "NL", "SG", "BR"].filter(
      (c) => adding.where !== "except" || !f.countries.includes(c),
    )[i % 5] ||
    "DE";
  const base = {
    id: `evt_preview${i}`,
    ts: Date.now() - i * 41_000,
    type: "redeem",
    outcome: "block",
    ip: `203.0.113.${42 + i * 7}`,
    country,
    city: { DE: "Frankfurt", US: "Ashburn", NL: "Amsterdam" }[country] ?? "",
    asn_org: ["Hetzner Online", "Amazon.com", "DigitalOcean"][i % 3],
    origin: "shop.example",
    browser: "Chrome 131",
    os: "Linux",
    flags: [],
  };
  if (t === "challenge")
    return { ...base, type: "challenge", outcome: "pass", reason: "" };
  if (t === "solve")
    return { ...base, outcome: "pass", reason: "", score: 0.08 };
  if (t === "siteverify")
    return { ...base, type: "siteverify", outcome: "pass", reason: "" };
  if (t === "siteverify_fail")
    return {
      ...base,
      type: "siteverify",
      outcome: "fail",
      reason: "token_not_found",
    };
  if (t === "limit")
    return { ...base, outcome: "limit", reason: "rate_limited" };
  if (t === "score")
    return {
      ...base,
      outcome: "pass",
      reason: "",
      score: Math.round(Math.min(0.99, Number(f.score) + 0.07) * 100) / 100,
      flags: ["window_exceeds_screen"],
    };
  if (t === "reason")
    return {
      ...base,
      reason: f.reasons[i % (f.reasons.length || 1)] ?? "behavior_automated",
    };
  if (t === "fail")
    return { ...base, outcome: "fail", reason: "invalid_solution" };
  if (t === "flagged")
    return {
      ...base,
      outcome: "pass",
      reason: "",
      flags: f.flags.length ? f.flags.slice(0, 2) : ["webdriver_true"],
    };
  if (t === "agent")
    return {
      ...base,
      reason: "behavior_agent",
      agent: f.agents[i % (f.agents.length || 1)] ?? "claude-in-chrome",
      os: "macOS",
    };
  if (t === "rule") {
    const id = f.rules[i % (f.rules.length || 1)] ?? rules?.[0]?.id;
    const rule = rules?.find((r) => r.id === id);
    return {
      ...base,
      outcome: rule?.action === "allow" ? "pass" : "block",
      reason: `rule:${id ?? "block-datacenters"}`,
      rule: id ?? "block-datacenters",
    };
  }
  return {
    ...base,
    reason: "instr_automated_browser",
    flags: ["headless_token"],
  };
}

const RELEASES = "https://github.com/tiagozip/cap/releases";

const INSTANCE_SAMPLES = {
  login: {
    summary: "Someone signed in to the dashboard",
    actor: { type: "dashboard", name: "Admin key" },
    ip: "198.51.100.7",
    ua: "Firefox 133 on macOS",
  },
  login_failed: {
    summary: "A dashboard sign-in failed",
    ip: "203.0.113.80",
    ua: "Chrome 131 on Linux",
  },
  access: {
    summary: 'Created the API key "deploy bot"',
    actor: { type: "dashboard", name: "Dashboard" },
  },
  keys: {
    summary: 'Changed the rules of "Shop"',
    actor: { type: "dashboard", name: "Dashboard" },
    keyName: "Shop",
  },
  settings: {
    summary: "Changed the rate limits",
    actor: { type: "dashboard", name: "Dashboard" },
  },
  automation: {
    trigger: "keys",
    summary: 'Blocked 203.0.113.0/24 on "Shop"',
    actor: { type: "mcp", name: "Claude" },
    keyName: "Shop",
  },
};

function samplePayload(t, n = 0) {
  if (INSTANCE_SAMPLES[t])
    return {
      type: "cap.instance",
      at: Date.now(),
      trigger: t,
      ...INSTANCE_SAMPLES[t],
    };
  if (t === "update")
    return {
      type: "cap.update",
      current: "4.0.18",
      latest: { version: "4.0.19", url: RELEASES },
    };
  if (t === "security")
    return {
      type: "cap.security",
      current: "4.0.18",
      latest: { version: "4.0.19", url: RELEASES },
      advisories: [
        {
          id: "example",
          summary: "Example advisory text appears here.",
          severity: "high",
          url: "https://github.com/tiagozip/cap/security/advisories",
          fixedIn: "4.0.19",
        },
      ],
    };
  if (t === "digest") {
    const kinds = adding.triggers.length ? adding.triggers : ["block"];
    const events = Array.from({ length: 6 }, (_, i) =>
      sampleEvent(kinds[i % kinds.length], i),
    );
    const now = Date.now();
    return {
      type: "cap.digest",
      site_key: siteKey,
      from: now - Number(adding.digest) * 1000,
      to: now,
      count: Math.max(Number(adding.min) || 0, 14),
      events,
    };
  }
  return { type: "cap.event", site_key: siteKey, event: sampleEvent(t, n) };
}

const previewItems = $derived(
  adding
    ? previewShown.map((t, n) => {
        const payload = samplePayload(t, n);
        return {
          payload,
          message: formatMessage(payload, {
            keyName: app.key?.name,
            ruleNames,
          }),
        };
      })
    : [],
);

async function add() {
  adding.error = "";
  adding.field = "";
  const generic = adding.service === "generic";
  if (generic) {
    const problem = urlProblem(adding.url);
    if (problem) {
      adding.error = problem;
      adding.field = "url";
      document.getElementById("hookUrl")?.focus();
      return;
    }
  }
  if (!adding.triggers.length) return;
  adding.busy = true;
  const body = {
    service: adding.service,
    name: adding.name.trim(),
    triggers: adding.triggers,
    digest: digesting ? Number(adding.digest) : 0,
    min: digesting ? Number(adding.min) : 0,
    filters: {
      ...adding.filters,
      countries: adding.where === "any" ? [] : adding.filters.countries,
      exceptCountries: adding.where === "except",
    },
    ...(generic
      ? {
          url: adding.url.trim(),
          headers: adding.headers.map(({ name, value }) => ({
            name: name.trim(),
            value,
          })),
        }
      : { config: adding.config }),
  };
  const editing = adding.id;
  const res = editing
    ? await api("PUT", `${base}/${editing}`, body)
    : await api("POST", `${base}`, body);
  adding.busy = false;
  if (!res.success) {
    adding.error =
      res.error ||
      (editing ? "Couldn't save this webhook" : "Couldn't add this webhook");
    adding.field = res.field ?? "";
    tick().then(() =>
      document
        .getElementById(
          adding?.field === "url" && generic
            ? "hookUrl"
            : `hook-${adding?.field}`,
        )
        ?.focus(),
    );
    return;
  }
  adding = null;
  if (editing) {
    hooks = hooks.map((x) =>
      x.id === editing ? (res.webhook ?? { ...x, ...body }) : x,
    );
    toast("Webhook saved");
    return;
  }
  if (res.webhook) {
    fresh = res.webhook.id;
    hooks = [...hooks, res.webhook];
  } else onchange();
  if (res.secret)
    secret = { value: res.secret, rotated: false, hook: res.webhook ?? null };
  else if (res.webhook) test(res.webhook);
}

async function toggle(h, enabled) {
  const res = await api("PUT", `${base}/${h.id}`, {
    enabled,
  });
  if (!res.success) {
    toast(res.error || "Couldn't update the webhook", "error");
    onchange();
    return;
  }
  hooks = hooks.map((x) =>
    x.id === h.id ? (res.webhook ?? { ...x, enabled }) : x,
  );
}

async function refreshLog(h) {
  const l = await api("GET", `${base}/${h.id}/deliveries`);
  if (!Array.isArray(l)) return;
  history = { ...history, [h.id]: l };
  if (log?.hook.id === h.id) log.rows = l;
}

async function test(h) {
  if (testing[h.id]) return;
  testing = { ...testing, [h.id]: true };
  const r = await api("POST", `${base}/${h.id}/test`);
  const who =
    (h.service ?? "generic") === "generic"
      ? "your server"
      : serviceOf(h.service).name;
  toast(
    r.ok
      ? `Test delivered, ${who} answered ${r.status}`
      : `Test failed: ${r.error || `HTTP ${r.status}`}`,
    r.ok ? "ok" : "error",
  );
  await refreshLog(h);
  tested = h.id;
  testing = { ...testing, [h.id]: false };
}

async function resend(h, event) {
  const r = await api("POST", `${base}/${h.id}/resend`, {
    event,
  });
  toast(
    r.ok ? "Sent again" : r.error || `Couldn't send it, HTTP ${r.status}`,
    r.ok ? "ok" : "error",
  );
  await refreshLog(h);
}

async function showLog(h) {
  const cached = history[h.id];
  if (cached) log = { hook: h, rows: cached };
  const l = await api("GET", `${base}/${h.id}/deliveries`);
  if (!Array.isArray(l)) {
    log ??= { hook: h, rows: [] };
    return;
  }
  history = { ...history, [h.id]: l };
  log = { hook: h, rows: l };
}

async function rotate(h) {
  const ok = await confirm({
    title: "Rotate the signing secret?",
    message:
      "Cap signs with a new secret from now on, so update your server right after.",
    confirmText: "Rotate secret",
    danger: true,
  });
  if (!ok) return;
  const res = await api("POST", `${base}/${h.id}/rotate`);
  if (!res.success) {
    toast(res.error || "Couldn't rotate the secret", "error");
    return;
  }
  hooks = hooks.map((x) => (x.id === h.id ? (res.webhook ?? x) : x));
  secret = { value: res.secret, rotated: true, hook: res.webhook ?? null };
}

function remove(h) {
  const at = hooks.indexOf(h);
  hooks = hooks.filter((x) => x.id !== h.id);
  undoable({
    message: "Webhook deleted",
    commit: async () => {
      const res = await api("DELETE", `${base}/${h.id}`);
      return res?.success ? null : res?.error || "Couldn't delete the webhook";
    },
    undo: () => {
      hooks = hooks.toSpliced(at, 0, h);
    },
  });
}
</script>

{#snippet logFooter()}
  <Button disabled={testing[log?.hook.id]} onclick={() => log && test(log.hook)}>
    {#if testing[log?.hook.id]}<Spinner class="size-3.5" label="Sending test" />{/if}
    Send test
  </Button>
  <Button variant="primary" onclick={() => (log = null)}>Done</Button>
{/snippet}

{#snippet addButton()}
  <Button size="sm" class="pl-2" onclick={() => startAdd()}>
    <Icon name="plus" size={14} />
    Add webhook
  </Button>
{/snippet}

{#snippet scopeLead(o)}
  <AgentIcon id={agentIconId(o.value)} size={16} />
{/snippet}

{#snippet countryLead(o)}
  <img src={flagUrl(o.value)} alt="" class="h-3 w-4 shrink-0 rounded-[2px] object-cover outline-1 -outline-offset-1 outline-foreground/8" loading="lazy" />
{/snippet}

{#snippet conditionSettings(t)}
  {@const scope = SCOPES[t]}
  {#if scope}
    <div class="ps-7">
      <MultiPick
        id="hook-{scope.key}"
        bind:value={adding.filters[scope.key]}
        options={scopeOptions(t)}
        any={scope.any}
        noun={scope.noun}
        empty={scope.empty}
        lead={t === "agent" ? scopeLead : undefined}
        onchange={() => (samples = [t])}
      />
    </div>
  {:else if t === "score"}
    <label class="flex items-center gap-3 ps-7">
      <span class="sr-only">Lowest risk score that sends</span>
      <input
        type="range"
        min="0.05"
        max="1"
        step="0.05"
        bind:value={adding.filters.score}
        class="h-1.5 min-w-0 flex-1 cursor-pointer accent-primary"
        oninput={() => (samples = ["score"])}
      />
      <span class="w-20 text-end text-sm tabular-nums">{Number(adding.filters.score).toFixed(2)} or more</span>
    </label>
  {/if}
{/snippet}

<Group id={groupId} title="Webhooks" description={instance ? "Sign-ins, changes, updates and security advisories for this whole server. Each site key has its own webhooks for its events." : undefined} flush>
  {#snippet action()}{@render addButton()}{/snippet}

{#if !hooks.length}
  <Empty title="No webhooks yet">{instance ? "Hear about sign-ins, changes, updates and security advisories in Discord, Slack, Telegram, ntfy or your own server." : "Send blocks, AI agents, rule matches and more to Discord, Slack, Telegram, ntfy or your own server."}</Empty>
{:else}
  <Table flush>
    <TableHeader>
      <TableRow>
        <TableHead>Sends to</TableHead>
        <TableHead class="max-md:hidden">When</TableHead>
        <TableHead class="w-px whitespace-nowrap max-sm:hidden">Last delivery</TableHead>
        <TableHead class="w-px"><span class="sr-only">On</span></TableHead>
        <TableHead class="w-px"><span class="sr-only">Actions</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each hooks as h (h.id)}
        {@const rows = history[h.id]}
        {@const d = rows === undefined ? undefined : (rows[0] ?? null)}
        {@const svc = serviceOf(h.service ?? "generic")}
        {@const generic = svc.id === "generic"}
        <TableRow class="motion-safe:[&>td]:transition-opacity motion-safe:[&>td]:duration-200 {h.enabled ? '' : '[&>td:not(:nth-last-child(-n+2))]:opacity-55'} {fresh === h.id ? 'wh-enter' : ''}">
          <TableCell class="w-full max-w-0 py-2.5!">
            <span class="flex min-w-0 items-center gap-3">
              <ServiceIcon service={svc.id} size={24} />
              <span class="flex min-w-0 flex-col gap-0.5">
                <span class="truncate font-medium">{h.name || (generic ? h.label : svc.name)}</span>
                {#if h.name || !generic}
                  <span class="truncate text-xs text-muted-foreground {generic ? 'font-mono' : ''}" title={h.label}>{h.name ? h.label : h.label === svc.name ? svc.blurb : h.label}</span>
                {/if}
                {#if h.paused && !h.enabled}
                  <span class="text-xs text-destructive">Paused after {h.paused.fails} failed deliveries in a row</span>
                {:else if d}
                  <span class="flex items-center gap-2 text-xs sm:hidden {d.ok ? 'text-muted-foreground' : 'text-destructive'}">{d.ok ? "Delivered" : "Failed"} {ago(d.at)}<HealthStrip {rows} max={20} /></span>
                {/if}
                <span class="mt-1 flex flex-wrap gap-1 md:hidden">
                  {#each h.triggers as t (t)}<Tag>{TRIGGER_LABELS[t] ?? t}</Tag>{/each}
                </span>
              </span>
            </span>
          </TableCell>
          <TableCell class="py-2.5! max-md:hidden">
            <span class="flex flex-wrap gap-1">
              {#each h.triggers as t (t)}<Tag>{TRIGGER_LABELS[t] ?? t}</Tag>{/each}
              {#if h.digest}<Tag>{DIGEST_LABELS[h.digest]}</Tag>{/if}
            </span>
          </TableCell>
          <TableCell class="whitespace-nowrap max-sm:hidden">
            {#if testing[h.id]}
              <span class="flex items-center gap-2 text-muted-foreground">
                <Spinner class="size-3.5" label="Sending test" />
                Sending test
              </span>
            {:else if d}
              <button
                type="button"
                class="flex cursor-pointer flex-col items-start rounded-sm text-left {tested === h.id ? 'wh-enter' : ''} outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:[&>span:first-child]:underline"
                onclick={() => showLog(h)}
              >
                <span class="font-medium {d.ok ? 'text-success' : 'text-destructive'}">{d.ok ? `Delivered, ${d.status}` : d.status ? `Failed, HTTP ${d.status}` : "Failed, no answer"}</span>
                <span class="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {Date.now() - d.at < 5000 ? "Just now" : ago(d.at)}
                  <HealthStrip {rows} max={20} />
                </span>
              </button>
            {:else if d === null}
              <span class="text-muted-foreground">Nothing sent yet</span>
            {:else}
              <span class="text-faint-foreground">Unknown</span>
            {/if}
          </TableCell>
          <TableCell class="pe-1">
            <Switch checked={h.enabled} label="Send to {title(h)}" onchange={(v) => toggle(h, v)} />
          </TableCell>
          <TableCell class="ps-1 pe-2.5">
            <Menu width="w-48">
              {#snippet trigger(props)}
                <Button {...props} variant="ghost" size="sm" icon aria-label="More for {title(h)}">
                  <Icon name="more" size={16} stroke={3} />
                </Button>
              {/snippet}
              <MenuItem icon="edit" onselect={() => startEdit(h)}>Edit</MenuItem>
              <MenuItem icon="share" onselect={() => test(h)}>Send test</MenuItem>
              <MenuItem icon="events" onselect={() => showLog(h)}>Show deliveries</MenuItem>
              {#if generic}
                <MenuItem icon="refresh" onselect={() => rotate(h)}>Rotate secret</MenuItem>
              {/if}
              <MenuSeparator />
              <MenuItem icon="trash" danger onselect={() => remove(h)}>Delete</MenuItem>
            </Menu>
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{/if}
</Group>

{#if adding}
  {@const svc = serviceOf(adding.service)}
  <Dialog title={adding.id ? "Edit webhook" : "Add webhook"} size="xl" guard onclose={() => (adding = null)}>
    <div class="grid gap-x-8 gap-y-6 md:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
    <form
      id="hookForm"
      class="flex min-w-0 flex-col gap-5"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <Field label="Send to" for="hookService">
        <Menu bind:open={picker} align="start" width="max-h-80">
          {#snippet trigger(props)}
            <button
              {...props}
              type="button"
              id="hookService"
              class="flex h-12 w-full cursor-pointer items-center gap-3 rounded-lg border border-input bg-transparent ps-2.5 pe-3 text-left text-sm transition-[border-color,box-shadow] duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [@media(hover:hover)]:hover:border-foreground/20"
            >
              <ServiceIcon service={svc.id} size={22} />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium">{svc.name}</span>
                <span class="truncate text-xs text-muted-foreground">{svc.blurb}</span>
              </span>
              <Icon name="selector" size={14} class="text-muted-foreground" />
            </button>
          {/snippet}
          {#each services as s (s.id)}
            <DropdownMenuItem onSelect={() => pickService(s.id)} class="gap-2.5 py-1.5">
              <ServiceIcon service={s.id} size={20} />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate">{s.name}</span>
                <span class="truncate text-xs text-muted-foreground">{s.blurb}</span>
              </span>
              {#if s.id === adding.service}<Icon name="check" size={14} class="text-muted-foreground" />{/if}
            </DropdownMenuItem>
            {#if s.id === "generic"}<MenuSeparator />{/if}
          {/each}
        </Menu>
      </Field>

      {#if svc.id === "generic"}
        <Field label="Endpoint URL" for="hookUrl" error={adding.field === "url" ? adding.error : ""}>
          <Input
            type="url"
            id="hookUrl"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://example.com/hooks/cap"
            bind:value={adding.url}
            invalid={adding.field === "url"}
            aria-describedby={adding.field === "url" ? "hookUrl-error" : undefined}
            oninput={() => {
              if (adding.field === "url") adding.error = urlProblem(adding.url);
            }}
          />
        </Field>
        <fieldset class="flex flex-col gap-2">
          <legend class="pb-2 text-sm font-medium">Headers <span class="font-normal text-muted-foreground">(optional)</span></legend>
          {#each adding.headers as h, i (i)}
            <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
              <Input aria-label="Header name" placeholder="Authorization" autocomplete="off" spellcheck="false" mono bind:value={h.name} />
              <Input aria-label="Header value" type="password" autocomplete="off" placeholder={h.saved ? "Saved, blank keeps it" : "Bearer …"} mono bind:value={h.value} />
              <Button variant="ghost" size="sm" icon aria-label="Remove header {h.name}" onclick={() => (adding.headers = adding.headers.toSpliced(i, 1))}>
                <Icon name="x" size={14} />
              </Button>
            </div>
          {/each}
          {#if adding.field === "headers"}<p class="text-sm text-destructive" role="alert">{adding.error}</p>{/if}
          {#if adding.headers.length < 10}
            <Button size="sm" variant="ghost" class="self-start pl-2" onclick={() => (adding.headers = [...adding.headers, { name: "", value: "" }])}>
              <Icon name="plus" size={14} />
              Add header
            </Button>
          {/if}
        </fieldset>
      {:else}
        {#each svc.fields as f (`${svc.id}:${f.key}`)}
          {@const saved = adding.secrets?.[f.key]}
          <Field label={f.label} for="hook-{f.key}" optional={f.optional} help={f.hint} error={adding.field === f.key ? adding.error : ""}>
            {#if f.kind === "select"}
              <Select id="hook-{f.key}" bind:value={adding.config[f.key]} options={f.options} />
            {:else}
              <Input
                id="hook-{f.key}"
                type={f.kind === "secret" ? "password" : f.kind === "url" ? "url" : "text"}
                inputmode={f.kind === "url" || f.key === "url" ? "url" : undefined}
                autocomplete="off"
                spellcheck="false"
                mono={f.kind === "secret"}
                placeholder={saved ? `Saved, ends in ${saved.slice(-4)}. Blank keeps it.` : (f.placeholder ?? "")}
                bind:value={adding.config[f.key]}
                invalid={adding.field === f.key}
                aria-describedby={adding.field === f.key ? `hook-${f.key}-error` : undefined}
              />
            {/if}
          </Field>
        {/each}
      {/if}

      <Field label="Name" for="hookName" optional>
        <Input id="hookName" maxlength={60} bind:value={adding.name} />
      </Field>

      <fieldset class="flex flex-col" aria-describedby={adding.triggers.length ? undefined : "hookTriggers-error"}>
        <legend class="pb-2 text-sm font-medium">Send when</legend>
        <ConditionPicker
          id="hookConditions"
          bind:value={adding.triggers}
          {available}
          settings={conditionSettings}
          onchange={(t) => (samples = t ? [t] : null)}
        />
        {#if !adding.triggers.length}
          <p id="hookTriggers-error" class="pt-2 text-sm text-muted-foreground">Add at least one condition.</p>
        {/if}
      </fieldset>

      {#if !instance}
        <Field label="From" for="hookWhere">
          <div class="flex flex-col gap-2">
            <Select id="hookWhere" bind:value={adding.where} options={WHERE} />
            {#if adding.where !== "any"}
              <MultiPick
                id="hook-countries"
                bind:value={adding.filters.countries}
                options={countryOptions}
                any="Pick countries"
                noun={["country", "countries"]}
                lead={countryLead}
              />
            {/if}
          </div>
        </Field>

        <Field label="How often" for="hookDigest" help={Number(adding.digest) ? "Cap groups matching events and sends one message with the counts, top reasons and countries." : ""}>
          <Select id="hookDigest" bind:value={adding.digest} options={(catalog.webhookDigests.length ? catalog.webhookDigests : [0]).map((v) => [v, DIGEST_LABELS[v] ?? `${v}s`])} onchange={() => (samples = null)} />
        </Field>

        {#if Number(adding.digest)}
          <Field label="Send the summary" for="hookMin">
            <Select id="hookMin" bind:value={adding.min} options={(catalog.webhookMinCounts.length ? catalog.webhookMinCounts : [0]).map((v) => [v, MIN_LABELS[v] ?? `At least ${v}`])} />
          </Field>
        {/if}
      {/if}

      {#if adding.error && !["url", "headers", ...svc.fields.map((f) => f.key)].includes(adding.field)}
        <p class="text-sm text-destructive" role="alert">{adding.error}</p>
      {/if}
    </form>

    <aside class="flex min-w-0 flex-col gap-3 md:sticky md:top-0 md:self-start" aria-label="Message preview">
      <div class="flex min-h-8 items-center gap-2">
        <ServiceIcon service={svc.id} size={16} />
        <h3 class="min-w-0 flex-1 truncate text-sm font-medium">How it looks in {svc.id === "generic" ? "your server" : svc.name}</h3>
        {#if previewOptions.length > 1}
          <Menu width="w-64" align="end">
            {#snippet trigger(props)}
              <Button {...props} size="sm" variant="ghost" class="-me-2 gap-1 pe-1.5">
                Customize
                <Icon name="down" size={13} class="text-muted-foreground" />
              </Button>
            {/snippet}
            {#each previewOptions as t (t)}
              <DropdownMenuCheckboxItem
                checked={previewShown.includes(t)}
                closeOnSelect={false}
                onCheckedChange={(v) => toggleSample(t, v)}
              >
                {t === "digest" ? "Summary" : (TRIGGER_LABELS[t] ?? t)}
              </DropdownMenuCheckboxItem>
            {/each}
          </Menu>
        {/if}
      </div>
      {#if previewItems.length}
        {#key `${svc.id}:${previewShown.join()}`}
          <div class="wh-preview">
            <MessagePreview service={svc.id} name={svc.name} items={previewItems} url={adding.url} config={adding.config} />
          </div>
        {/key}
      {:else}
        <div class="grid min-h-40 place-items-center rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">Add a condition to see the message.</div>
      {/if}
      <p class="text-xs text-pretty text-muted-foreground">Sample values. Real messages show your events.</p>
    </aside>
    </div>
    {#snippet footer()}
      <Button onclick={() => (adding = null)}>Cancel</Button>
      <Button variant="primary" type="submit" form="hookForm" disabled={adding.busy || !adding.triggers.length} aria-busy={adding.busy}>
        {#if adding.busy}<Spinner class="size-3.5" label={adding.id ? "Saving webhook" : "Adding webhook"} />{/if}
        {adding.id ? "Save webhook" : "Add webhook"}
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if secret}
  <Dialog
    guard
    title={secret.rotated ? "New signing secret" : "Webhook added"}
    description="Copy the signing secret now. Cap only shows it once."
    size="md"
    onclose={() => (secret = null)}
  >
    <Field label="Signing secret">
      <CopyText value={secret.value} label="Copy secret" />
    </Field>
    <div class="flex flex-col gap-2">
      <p class="text-sm text-pretty text-muted-foreground">
        Each request has a <code class="font-mono text-sm whitespace-nowrap text-foreground">cap-signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> header, an HMAC-SHA256 of <code class="font-mono text-sm text-foreground">t.body</code> with this secret. Check it before trusting the body.
      </p>
      <CodeBlock class="min-w-0" filename="verify.js" language="js" download={false} code={VERIFY} html={highlight(VERIFY)} />
    </div>
    {#snippet footer()}
      {#if secret.hook}
        {@const hook = hooks.find((x) => x.id === secret.hook.id) ?? secret.hook}
        <Button disabled={testing[hook.id]} onclick={() => test(hook)}>
          {#if testing[hook.id]}<Spinner class="size-3.5" label="Sending test" />{/if}
          {tested === hook.id && history[hook.id]?.[0] ? (history[hook.id][0].ok ? "Test delivered" : "Test failed, try again") : "Send test"}
        </Button>
      {/if}
      <Button variant="primary" onclick={() => (secret = null)}>Done</Button>
    {/snippet}
  </Dialog>
{/if}

{#if log}
  <Dialog open={!eventView?.open} title="Recent deliveries" description={title(log.hook)} size="md" footer={log.rows.length ? logFooter : undefined} onclose={() => (log = null)}>
    <DeliveryLog rows={log.rows} onevent={openEvent} onresend={(id) => resend(log.hook, id)} testing={testing[log.hook.id]} highlight={tested === log.hook.id} ontest={() => test(log.hook)} />
  </Dialog>
{/if}

{#if eventView}
  <eventView.Component
    bind:open={
      () => eventView?.open ?? false,
      (v) => {
        if (!v) closeEvent();
      }
    }
    id={eventView.id}
    {siteKey}
    onfilter={closeEvent}
  />
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .wh-preview {
      animation: wh-preview 220ms cubic-bezier(0.23, 1, 0.32, 1);
    }
  }

  @keyframes wh-preview {
    from {
      opacity: 0;
      transform: translateY(4px);
      filter: blur(3px);
    }
  }
</style>
