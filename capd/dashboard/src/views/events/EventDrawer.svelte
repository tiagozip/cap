<script>
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import {
  Button,
  CodeBlock,
  CopyButton,
  Drawer,
  Icon,
  Menu,
  MenuItem,
  MenuSeparator,
  Skeleton,
  Tip,
} from "../../components/cap/index.js";
import { Kbd } from "../../components/ui/kbd/index.js";
import { api } from "../../lib/api.js";
import {
  agentName,
  catalog,
  EVENT_TYPES,
  reasonLabel,
  signalInfo,
} from "../../lib/catalog.svelte.js";
import { ago, compact, fullFmt, latency } from "../../lib/format.js";
import { flagUrl } from "../../lib/geo.js";
import { app } from "../../lib/state.svelte.js";
import { undoable } from "../../lib/ui.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import History from "../../polish/event-detail/History.svelte";
import AddToListModal, { prefetchLists } from "./AddToListModal.svelte";
import {
  eventSentence,
  failKind,
  filterValueLabel,
  groupSolves,
  isFlagged,
} from "./labels.js";

let {
  open = $bindable(false),
  id,
  solve = null,
  timedOut = false,
  siteKey,
  onopen,
  onfilter,
  onstep,
} = $props();

let res = $state(null);
let ctx = $state(null);
let missing = $state(false);
let blockedIps = $state(null);
let blockedFor = null;
let listCandidates = $state(null);
let top = $state(null);
let openSteps = $state(new Set());

$effect(() => {
  const sk = siteKey;
  if (open) prefetchLists();
  if (!open || !sk || blockedFor === sk) return;
  blockedFor = sk;
  blockedIps = null;
  api("GET", `/keys/${sk}/blocked-ips`).then((r) => {
    if (sk !== siteKey || !Array.isArray(r)) return;
    blockedIps = new Set(
      r
        .filter((x) => x.type === "ip" || x.type === "asn")
        .map((x) => (x.type === "asn" ? asnKey(x.ip) : `ip:${x.ip}`)),
    );
  });
});

$effect(() => {
  const want = id;
  if (!want) return;
  res = null;
  ctx = null;
  missing = false;
  openSteps = new Set();
  scrollToTop(top);
  api(
    "GET",
    `/keys/${siteKey}/events/${encodeURIComponent(want)}/context`,
  ).then((r) => {
    if (want === id && r && r.success !== false) ctx = r;
  });
  api("GET", `/keys/${siteKey}/events/${encodeURIComponent(want)}`).then(
    (r) => {
      if (want !== id) return;
      if (r?.event) res = r;
      else missing = true;
    },
  );
});

const DECISIONS = {
  timeout: [
    "Not solved",
    "text-muted-foreground",
    "clock",
    "bg-muted text-muted-foreground",
  ],
  issued: ["Issued", "text-muted-foreground", "radar", "bg-info/12 text-info"],
  pass: ["Allowed", "text-foreground", "check", "bg-success/12 text-success"],
  flagged: ["Flagged", "text-warning", "flag", "bg-warning/15 text-warning"],
  fail: [
    "Failed",
    "text-muted-foreground",
    "ban",
    "bg-muted text-muted-foreground",
  ],
  failBad: [
    "Failed",
    "text-destructive",
    "ban",
    "bg-destructive/12 text-destructive",
  ],
  block: [
    "Blocked",
    "text-destructive",
    "ban",
    "bg-destructive/12 text-destructive",
  ],
  limit: ["Rate limited", "text-violet", "clock", "bg-violet/12 text-violet"],
};
const KINDS = {
  challenge: ["Challenge issued", "radar", "bg-info/12 text-info"],
  redeem: ["Challenge solved", "check", "bg-primary/12 text-primary"],
  siteverify: ["Token verified", "key", "bg-success/12 text-success"],
};
const ORDER = { challenge: 0, redeem: 1, siteverify: 2 };
const issued = (x) => x.type === "challenge" && x.outcome === "pass";
const decisionOf = (x) =>
  DECISIONS[
    issued(x)
      ? "issued"
      : isFlagged(x)
        ? "flagged"
        : x.outcome === "fail"
          ? failKind(x)
          : x.outcome
  ] ?? [x.outcome, "text-foreground"];
const kindOf = (x) =>
  x.outcome === "block"
    ? ["Request blocked", "ban", "bg-destructive/12 text-destructive"]
    : x.outcome === "limit"
      ? ["Too many requests", "clock", "bg-violet/12 text-violet"]
      : x.outcome === "fail" && x.type === "redeem"
        ? ["Solve failed", "ban", "bg-muted text-muted-foreground"]
        : x.outcome === "fail" && x.type === "siteverify"
          ? ["Verify failed", "ban", "bg-muted text-muted-foreground"]
          : (KINDS[x.type] ?? [
              EVENT_TYPES[x.type] ?? x.type,
              "events",
              "bg-muted text-muted-foreground",
            ]);

const stepNote = (x) =>
  x.type === "challenge"
    ? (x.origin ?? "")
    : x.type === "redeem" && x.outcome === "pass" && x.solve_ms
      ? `in ${latency(x.solve_ms)}`
      : x.type === "siteverify" && x.outcome === "pass"
        ? verifyNote(x)
        : x.reason
          ? reasonLabel(x.reason)
          : "";
const verifyNote = (x) => {
  const r = steps?.find((y) => y.type === "redeem" && y.outcome === "pass");
  const d = r && x.ts - r.ts;
  return d > 0
    ? `By your server, ${latency(d)} after the solve`
    : "By your server";
};
const stepTime = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const e = $derived(res?.event);
const steps = $derived.by(() => {
  if (!solve) {
    if (!e) return null;
    if (issued(e)) return [e];
    const c = e.type === "redeem" ? res.related.challenge : null;
    const all = [...(c ? [c] : []), e, ...res.related.chain].toSorted(
      (a, b) => ORDER[a.type] - ORDER[b.type] || a.ts - b.ts,
    );
    return all.length > 1 ? all : null;
  }
  const c = res?.related.challenge;
  return c && !solve.events.some((x) => x.type === "challenge")
    ? [c, ...solve.events]
    : solve.events;
});
const took = $derived(steps?.length > 1 ? steps.at(-1).ts - steps[0].ts : 0);
const gap = $derived.by(() => {
  if (!steps) return null;
  const redeem = steps.find((x) => x.type === "redeem");
  if (!redeem)
    return timedOut
      ? ["Not solved", "The challenge expired after 15 minutes"]
      : ["Not solved yet", "The challenge is still waiting for a solution"];
  if (redeem.outcome === "pass" && !steps.some((x) => x.type === "siteverify"))
    return ["Not verified", "Your server never checked this token"];
  return null;
});
const decision = $derived(
  solve
    ? (DECISIONS[
        solve.decision === "fail"
          ? failKind(solve.events.find((x) => x.outcome === "fail") ?? {})
          : solve.decision
      ] ?? DECISIONS.pass)
    : timedOut
      ? DECISIONS.timeout
      : e
        ? decisionOf(e)
        : null,
);
const kind = $derived(e ? kindOf(e) : null);
const ipGroups = $derived.by(() => {
  if (!res) return [];
  const own = new Set((steps ?? []).map((x) => x.id));
  return groupSolves(res.related.ip.filter((x) => !own.has(x.id)));
});
const ipSolves = $derived(ipGroups.slice(0, 12));
const DAY = 86_400_000;
const span = $derived.by(() => {
  if (!e) return null;
  const from = Math.min(e.ts - DAY, ...ipGroups.map((g) => g.ts));
  const to = Math.max(Math.min(e.ts + DAY, Date.now()), e.ts + 1);
  const hours = Math.round((to - from) / 3_600_000);
  const rel = (t) => {
    const m = Math.round(Math.abs(t - e.ts) / 60_000);
    const n = m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`;
    return `${n} ${t < e.ts ? "before" : "after"}`;
  };
  return {
    from: rel(from),
    to: to >= Date.now() - 60_000 ? "Now" : rel(to),
    at: ((e.ts - from) / (to - from)) * 100,
    label: `${hours} hours`,
    start: from,
    end: to,
  };
});
const pos = (t) =>
  Math.min(
    100,
    Math.max(0, ((t - span.start) / (span.end - span.start)) * 100),
  );
const groupDecision = (g) =>
  g.timedOut
    ? DECISIONS.timeout
    : g.events.length > 1
      ? (DECISIONS[
          g.decision === "fail"
            ? failKind(g.events.find((y) => y.outcome === "fail") ?? {})
            : g.decision
        ] ?? DECISIONS.pass)
      : decisionOf(g.main);
const DOTS = {
  Allowed: "bg-success",
  Issued: "bg-info",
  Flagged: "bg-warning",
  Failed: "bg-muted-foreground",
  Blocked: "bg-destructive",
  "Rate limited": "bg-violet",
  "Not solved": "bg-faint-foreground",
};
const PROTOCOLS = { hashwx: "HashWX", "sha256-pow": "SHA-256" };
const facts = (x) =>
  [
    ["Time", fullFmt.format(new Date(x.ts))],
    ["Website", x.origin],
    ["Reason", x.reason && reasonLabel(x.reason)],
    ["Solve time", x.solve_ms != null && `${(x.solve_ms / 1000).toFixed(2)}s`],
    ["Protocol", x.protocol && (PROTOCOLS[x.protocol] ?? x.protocol)],
    [
      "Verdict",
      x.verdict &&
        (x.verdict === "ok"
          ? "OK"
          : `${x.verdict.charAt(0).toUpperCase()}${x.verdict.slice(1)}`),
    ],
    ["Risk", x.score != null && `${Math.round(x.score * 100)} of 100`],
    [
      "Signals",
      x.flags?.length && x.flags.map((f) => signalInfo(f).text).join(", "),
    ],
    ["Rule", x.rule],
    ["IP", x.ip !== e?.ip && x.ip],
    ["Browser", x.ua !== e?.ua && [x.browser, x.os].filter(Boolean).join(", ")],
    ["Token", x.token_id],
    ["Event ID", x.id],
  ].filter(([, v]) => v);
const signals = $derived(
  (e?.flags ?? [])
    .filter(
      (f) =>
        !(e.rule && f.startsWith("rule:")) &&
        !(e.agent && f.startsWith("agent:")),
    )
    .map((f) => {
      const w = catalog.risk.weights[f];
      return {
        ...signalInfo(f),
        id: f,
        w: w == null ? null : Math.round(w * 100),
      };
    })
    .toSorted((a, b) => (b.w ?? -1) - (a.w ?? -1)),
);
const scoreWord = (s) =>
  s >= 0.75 ? "Looks automated" : s >= 0.4 ? "Suspicious" : "Looks human";

const similar = $derived(
  e
    ? [
        e.ip && ["ip", e.ip, "From this IP"],
        e.fp && ["fp", e.fp, "From this visitor"],
        e.reason && ["reason", e.reason, "With this reason"],
        e.asn_org && ["asn_org", e.asn_org, "From this network"],
        e.country && [
          "country",
          e.country,
          `From ${filterValueLabel("country", e.country)}`,
        ],
        e.agent && ["agent", e.agent, `From ${agentName(e.agent)}`],
        e.browser && ["browser", e.browser, `From ${e.browser}`],
      ].filter(Boolean)
    : [],
);

const asnKey = (v) => `asn:${String(v).replace(/^AS/i, "")}`;
const blocked = $derived(!!e?.ip && !!blockedIps?.has(`ip:${e.ip}`));
const netBlocked = $derived(!!e?.asn && !!blockedIps?.has(asnKey(e.asn)));
const DURATIONS = { 3600: "for an hour", 86400: "for a day" };

const setBlocked = (k, on) => {
  const next = new Set(blockedIps);
  if (on) next.add(k);
  else next.delete(k);
  blockedIps = next;
};

function toggleBlock(type = "ip", duration = 0) {
  const value = type === "asn" ? String(e.asn) : e.ip;
  const k = type === "asn" ? asnKey(value) : `ip:${value}`;
  const name = type === "asn" ? e.asn_org || `AS${value}` : value;
  const on = !blockedIps?.has(k);
  setBlocked(k, on);
  undoable({
    message: on
      ? `Blocked ${name} ${DURATIONS[duration] ?? "on this key"}`
      : `Unblocked ${name}`,
    commit: async () => {
      const r = await api(
        "POST",
        `/keys/${siteKey}/${on ? "block-ip" : "unblock-ip"}`,
        { type, value, ...(on && duration ? { duration } : {}) },
      );
      return r?.success
        ? null
        : r?.error ||
            `Couldn't ${on ? "block" : "unblock"} this ${type === "asn" ? "network" : "IP"}`;
    },
    undo: () => setBlocked(k, !on),
  });
}

const openList = () => {
  listCandidates = [
    { kind: "ip", value: e.ip },
    ...(e.fp ? [{ kind: "visitor", value: e.fp }] : []),
    ...(e.asn ? [{ kind: "asn", value: String(e.asn), label: e.asn_org }] : []),
  ];
};

const shortcut = (ev) => {
  if (
    !open ||
    !e?.ip ||
    listCandidates ||
    ev.defaultPrevented ||
    ev.metaKey ||
    ev.ctrlKey ||
    ev.altKey ||
    ev.isComposing ||
    ev.target.closest?.(
      "input, textarea, select, [contenteditable]:not([contenteditable=false])",
    ) ||
    document.querySelector(
      "[role=alertdialog][data-state=open], [role=menu][data-state=open]",
    )
  )
    return;
  const k = ev.key.toLowerCase();
  if (k === "b") {
    ev.preventDefault();
    toggleBlock("ip");
  } else if (k === "a") {
    ev.preventDefault();
    openList();
  }
};
</script>

{#snippet row(label, value, filter)}
  <div class="ed-row grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
    <dt class="text-xs text-muted-foreground">{label}</dt>
    <dd class="min-w-0 text-sm break-words tabular-nums">
      {#if filter}
        <span class="flex items-start gap-2">
          <span class="min-w-0 flex-1">{@render value()}</span>
          <button
            type="button"
            class="ed-copy -my-0.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
            aria-label="Show events with this {label.toLowerCase()}"
            title="Show events with this {label.toLowerCase()}"
            onclick={() => onfilter(filter)}
          >
            <Icon name="search" size={13} />
          </button>
        </span>
      {:else}
        {@render value()}
      {/if}
    </dd>
  </div>
{/snippet}

{#snippet section(title)}
  <h3 class="pb-1.5 text-sm font-semibold">{title}</h3>
{/snippet}

{#snippet mini(list)}
  <ul class="-mx-2 flex flex-col">
    {#each list as g (g.id)}
      {@const x = g.main}
      {@const many = g.events.length > 1}
      {@const d = groupDecision(g)}
      {@const quiet = d[0] === "Issued" || d[0] === "Allowed"}
      {@const origin = g.client.origin ? `on ${g.client.origin}` : ""}
      {@const note = many && x.type === "redeem" && x.outcome === "pass" && x.solve_ms ? `in ${latency(x.solve_ms)} ${origin}` : x.type === "challenge" || many ? origin : x.type === "siteverify" && x.outcome === "pass" ? "by your server" : stepNote(x)}
      <li>
        <button
          type="button"
          class="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted"
          onclick={() => onopen(x.id, g)}
        >
          <span class="min-w-0 flex-1 truncate">
            {g.timedOut ? "Challenge expired" : many ? g.title : kindOf(x)[0]}
            {#if note}<span class="ms-1 text-muted-foreground">{note}</span>{/if}
          </span>
          {#if !quiet}<span class="shrink-0 text-xs font-medium {d[1]}">{d[0]}</span>{/if}
          <span class="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{ago(g.ts)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<svelte:window onkeydown={shortcut} />

<Drawer
  bind:open
  title={!solve && !timedOut && e && issued(e) ? kind[0] : decision ? decision[0] : "Event"}
  titleClass={!solve && !timedOut && e && issued(e) ? "" : decision ? decision[1] : ""}
  description={e ? (solve || issued(e) ? fullFmt.format(new Date(e.ts)) : `${kind[0]}, ${fullFmt.format(new Date(e.ts))}`) : "Loading the event"}
>
  {#snippet actions()}
    {#if onstep}
      {#each [[-1, "up", "Previous event", "K"], [1, "down", "Next event", "J"]] as [d, icon, label, key] (d)}
        <Button variant="ghost" size="sm" icon aria-label={label} aria-keyshortcuts={key} onclick={() => onstep(d)}>
          <Icon name={icon} size={16} />
        </Button>
      {/each}
    {/if}
  {/snippet}
  {#snippet lead()}
    {#if decision?.[2]}
      <span class="flex size-8 shrink-0 items-center justify-center rounded-lg transition-[background-color,color] duration-200 {decision[3]}" aria-hidden="true">
        {#key decision[2]}
          <span class="ed-swap flex"><Icon name={decision[2]} size={15} stroke={2.25} /></span>
        {/key}
      </span>
    {/if}
  {/snippet}
  <div bind:this={top} class="flex flex-col text-sm">
    {#if missing}
      <p class="text-muted-foreground">This event is past its retention period and was deleted.</p>
    {:else}
      <Skeleton loading={!e} label="Loading the event">
        {#if e}
          {@const v = res.related.visitor}
          {@const flags = e.flags ?? []}
          <div class="flex flex-col">
            {#if timedOut}
              <p class="pb-3 text-pretty">Nothing solved this challenge within 15 minutes, so it expired.</p>
            {:else if !solve && !issued(e) && e.outcome === "pass"}
              <p class="pb-3 text-pretty">{eventSentence(e)}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-2 pb-5">
              {#if e.ip}
                <div class="flex">
                  <Tip side="bottom">
                    {#snippet content()}<span class="flex items-center gap-2">{blocked ? "Unblock" : "Block"} this IP <Kbd>B</Kbd></span>{/snippet}
                    {#snippet children(props)}
                      <Button {...props} size="sm" class="rounded-e-none {blocked ? '' : 'text-destructive'}" aria-pressed={blocked} onclick={() => toggleBlock("ip")}>
                        {#key blocked}
                          <span class="ed-swap flex"><Icon name={blocked ? "check" : "ban"} size={14} class={blocked ? "text-success" : ""} /></span>
                        {/key}
                        {blocked ? "Blocked" : "Block this IP"}
                      </Button>
                    {/snippet}
                  </Tip>
                  <Menu width="w-64" align="start">
                    {#snippet trigger(props)}
                      <Button {...props} size="sm" icon class="-ms-px rounded-s-none" aria-label="More ways to block">
                        <Icon name="down" size={14} class="text-muted-foreground" />
                      </Button>
                    {/snippet}
                    {#if !blocked}
                      <MenuItem icon="clock" onselect={() => toggleBlock("ip", 3600)}>Block this IP for an hour</MenuItem>
                      <MenuItem icon="clock" onselect={() => toggleBlock("ip", 86400)}>Block this IP for a day</MenuItem>
                    {/if}
                    {#if e.asn}
                      {#if !blocked}<MenuSeparator />{/if}
                      <MenuItem icon={netBlocked ? "check" : "ban"} danger={!netBlocked} onselect={() => toggleBlock("asn")}>
                        <span class="block truncate">{netBlocked ? "Unblock" : "Block"} {e.asn_org || "this network"}</span>
                        <span class="block text-xs text-muted-foreground">AS{e.asn}, every IP on it</span>
                      </MenuItem>
                    {/if}
                    {#if blocked && !e.asn}
                      <MenuItem icon="check" onselect={() => toggleBlock("ip")}>Unblock this IP</MenuItem>
                    {/if}
                  </Menu>
                </div>
                <Tip side="bottom">
                  {#snippet content()}<span class="flex items-center gap-2">Add to a list <Kbd>A</Kbd></span>{/snippet}
                  {#snippet children(props)}
                    <Button {...props} size="sm" onclick={openList}>
                      <Icon name="list" size={14} />
                      Add to list
                    </Button>
                  {/snippet}
                </Tip>
              {/if}
              {#if similar.length}
                <Menu width="w-60" align="start">
                  {#snippet trigger(props)}
                    <Button size="sm" {...props}>
                      Similar events
                      <Icon name="down" size={14} class="text-muted-foreground" />
                    </Button>
                  {/snippet}
                  {#each similar as [field, value, label] (field)}
                    <MenuItem onselect={() => onfilter(`${field}:${value}`)}>{label}</MenuItem>
                  {/each}
                </Menu>
              {/if}
            </div>

            {#if steps}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                <div class="flex items-baseline justify-between gap-3 pb-1.5">
                  <h3 class="text-sm font-semibold">{steps.some((x) => x.type === "redeem" && x.outcome === "pass") ? "This solve" : steps.some((x) => x.type !== "challenge") ? "This attempt" : "This challenge"}</h3>
                  {#if took > 0}<span class="text-xs text-muted-foreground tabular-nums">{latency(took)} start to finish</span>{/if}
                </div>
                <ol class="-mx-2 flex flex-col">
                  {#each steps as x, i (x.id)}
                    {@const ok = x.outcome === "pass"}
                    {@const shown = openSteps.has(x.id)}
                    <li class="ed-step relative" style="--i: {i}">
                      {#if i < steps.length - 1}
                        <span class="absolute top-7 bottom-[-0.375rem] left-[1.0625rem] w-px bg-border" aria-hidden="true"></span>
                      {:else if gap}
                        <span class="absolute top-7 bottom-[-0.375rem] left-[1.0625rem] border-s border-dashed border-border" aria-hidden="true"></span>
                      {/if}
                      <button
                        type="button"
                        class="flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted"
                        aria-expanded={shown}
                        aria-controls="step-{x.id}"
                        onclick={() => {
                          const next = new Set(openSteps);
                          if (shown) next.delete(x.id);
                          else next.add(x.id);
                          openSteps = next;
                        }}
                      >
                        <span class="flex h-lh items-center">
                          <span class="flex size-[18px] items-center justify-center rounded-full {ok ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}" aria-hidden="true">
                            <Icon name={ok ? "check" : "x"} size={11} stroke={2.5} />
                          </span>
                        </span>
                        <span class="flex min-w-0 flex-1 flex-col">
                          <span class={!solve && x.id === e.id && steps.length > 1 ? "font-medium" : ""}>{kindOf(x)[0]}{#if !solve && x.id === e.id && steps.length > 1}<span class="sr-only">, this event</span>{/if}</span>
                          {#if stepNote(x)}<span class="text-xs text-pretty break-words text-muted-foreground">{stepNote(x)}</span>{/if}
                        </span>
                        <span class="flex h-lh items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          {stepTime.format(new Date(x.ts))}
                          <Icon name="down" size={14} class="transition-[rotate] duration-150 motion-reduce:transition-none {shown ? 'rotate-180' : ''}" />
                        </span>
                      </button>
                      {#if shown}
                        <dl id="step-{x.id}" class="ed-facts mb-1 ms-[2.375rem] me-2 flex flex-col rounded-lg bg-muted/60 px-3 py-1.5">
                          {#each facts(x) as [label, value] (label)}
                            <div class="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-3 py-1">
                              <dt class="text-xs text-muted-foreground">{label}</dt>
                              <dd class="min-w-0 text-xs break-words tabular-nums {label === 'Token' || label === 'Event ID' || label === 'IP' ? 'font-mono' : ''}">{value}</dd>
                            </div>
                          {/each}
                        </dl>
                      {/if}
                    </li>
                  {/each}
                  {#if gap}
                    <li class="ed-step flex items-start gap-3 px-2 py-1.5 text-muted-foreground" style="--i: {steps.length}">
                      <span class="flex h-lh items-center">
                        <span class="relative flex size-[18px] items-center justify-center rounded-full border border-dashed border-faint-foreground" aria-hidden="true">
                          <span class="h-2.5 w-px rotate-45 rounded-full bg-faint-foreground"></span>
                        </span>
                      </span>
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span>{gap[0]}</span>
                        <span class="truncate text-xs">{gap[1]}</span>
                      </span>
                    </li>
                  {/if}
                </ol>
              </section>
            {/if}

            <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
              {@render section("What happened")}
              <dl class="flex flex-col">
                {#if e.reason && e.reason !== "rate_limited"}
                  {#snippet reason()}{reasonLabel(e.reason)}{/snippet}
                  {@render row("Reason", reason, `reason:${e.reason}`)}
                {/if}
                {#if e.solve_ms != null && !steps?.some((x) => x.type === "redeem" && x.outcome === "pass")}
                  {#snippet solve()}{(e.solve_ms / 1000).toFixed(2)}s{/snippet}
                  {@render row("Solve time", solve)}
                {/if}
                {#if e.agent}
                  {#snippet agent()}
                    <span class="inline-flex items-center gap-2 align-middle"><AgentIcon id={e.agent} size={14} />{agentName(e.agent)}</span>
                    <span class="block text-xs text-muted-foreground">{e.agent_confidence ? `${e.agent_confidence.charAt(0).toUpperCase()}${e.agent_confidence.slice(1)} confidence` : ""}{e.agent_verified ? ", signature verified" : ""}</span>
                  {/snippet}
                  {@render row("AI agent", agent, `agent:${e.agent}`)}
                {/if}
                {#if e.verdict}
                  {#snippet verdict()}{e.verdict === "ok" ? "OK" : `${e.verdict.charAt(0).toUpperCase()}${e.verdict.slice(1)}`}{/snippet}
                  {@render row("Verdict", verdict)}
                {/if}
                {#if e.rule}
                  {#snippet rule()}{e.rule}{/snippet}
                  {@render row("Rule", rule, `rule:${e.rule}`)}
                {/if}
                {#if e.protocol}
                  {#snippet protocol()}{({ hashwx: "HashWX", "sha256-pow": "SHA-256" })[e.protocol] ?? e.protocol}{/snippet}
                  {@render row("Protocol", protocol)}
                {/if}
              </dl>
            </section>

            {#if e.score != null || flags.length}
              {@const pct = e.score == null ? null : Math.round(e.score * 100)}
              {@const line = Math.round((app.key?.config?.behaviorThreshold ?? catalog.risk.threshold) * 100)}
              {@const tone = pct >= line ? ["text-destructive", "bg-destructive"] : pct >= 40 ? ["text-warning", "bg-warning"] : ["text-success", "bg-success"]}
              {@const weighted = signals.filter((s) => s.w != null)}
              {@const capped = pct != null && weighted.length > 0 && weighted.every((s) => s.strength !== "strong") && pct === Math.round(catalog.risk.weakCap * 100)}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4" aria-labelledby="ed-risk">
                <div class="flex items-baseline justify-between gap-3">
                  <h3 id="ed-risk" class="text-sm font-semibold">{flags.length ? "Why" : "Risk"}</h3>
                  {#if pct != null}
                    <span class="flex items-baseline gap-2 text-xs text-muted-foreground">
                      {scoreWord(e.score)}
                      <span class="text-base font-semibold {tone[0]} tabular-nums">{pct}</span>
                    </span>
                  {/if}
                </div>
                {#if pct != null}
                  <div class="relative mt-2.5 mb-7" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label="Risk, blocks at {line}">
                    <div class="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div class="ed-fill h-full origin-left rounded-full {tone[1]}" style="width: {Math.max(pct, 1.5)}%"></div>
                    </div>
                    <span class="absolute -top-1 h-3.5 w-px bg-foreground/60" style="left: {line}%" aria-hidden="true"></span>
                    <span class="absolute top-3 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums" style="left: {line}%" aria-hidden="true">Blocks at {line}</span>
                  </div>
                {/if}
                {#if signals.length}
                  <ul class="-mx-2 flex flex-col">
                    {#each signals as s, i (s.id)}
                      <li class="ed-step" style="--i: {i}">
                        <button
                          type="button"
                          class="flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted"
                          title="Show events with this signal"
                          onclick={() => onfilter(`flag:${s.id}`)}
                        >
                        <span class="flex h-lh shrink-0 items-center" aria-hidden="true">
                          <span class="size-1.5 rounded-full {s.strength === 'strong' ? 'bg-warning' : 'bg-faint-foreground'}"></span>
                        </span>
                        <span class="flex min-w-0 flex-1 flex-col">
                          <span class="text-pretty">{s.text}</span>
                          <span class="text-xs text-muted-foreground">{s.group ?? "Signal"}{s.strength === "strong" ? ", strong" : ""}</span>
                        </span>
                        {#if s.w != null}
                          <span class="flex h-lh shrink-0 items-center gap-2">
                            <span class="h-1 w-10 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <span class="ed-fill block h-full origin-left rounded-full {s.strength === 'strong' ? 'bg-warning' : 'bg-muted-foreground'}" style="width: {s.w}%; --i: {i}"></span>
                            </span>
                            <span class="w-6 text-right text-xs text-muted-foreground tabular-nums"><span class="sr-only">weight </span>{s.w}</span>
                          </span>
                        {/if}
                        </button>
                      </li>
                    {/each}
                  </ul>
                {:else if pct != null}
                  <p class="text-xs text-muted-foreground">No signals fired.</p>
                {/if}
                {#if capped}
                  <p class="pt-1.5 text-xs text-muted-foreground text-pretty">Only weak signals fired, so the risk stops at {pct}.</p>
                {/if}
              </section>
            {/if}

            {#if ctx && (ctx.ip || ctx.visitor || ctx.network)}
              <History {ctx} {siteKey} />
            {/if}

            <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
              {@render section("Visitor")}
              <dl class="flex flex-col">
                {#if e.ip}
                  {#snippet ip()}
                    <span class="flex items-center gap-2">
                      <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span class="font-mono text-xs">{e.ip}</span>
                      {#if e.country}
                        <span class="flex items-center gap-1.5 text-muted-foreground">
                          {#if flagUrl(e.country)}
                            <img
                              src={flagUrl(e.country)}
                              alt=""
                              class="size-4 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
                              width="16"
                              height="16"
                              onerror={(ev) => (ev.currentTarget.style.visibility = "hidden")}
                            />
                          {/if}
                          {filterValueLabel("country", e.country)}
                        </span>
                      {/if}
                      {#if blocked}<span class="ed-swap rounded-sm bg-destructive/12 px-1.5 text-xs leading-5 font-medium text-destructive">Blocked</span>{/if}
                      </span>
                      <CopyButton text={e.ip} label="Copy IP" size="icon-xs" class="ed-copy -my-1 ms-auto text-muted-foreground" />
                    </span>
                  {/snippet}
                  {@render row("IP", ip)}
                {/if}
                {#if e.asn_org}
                  {#snippet net()}{e.asn_org} {#if e.asn}<span class="text-muted-foreground">AS{e.asn}</span>{/if}{/snippet}
                  {@render row("Network", net, `asn_org:${e.asn_org}`)}
                {/if}
                {#if e.browser || e.os || e.platform}
                  {#snippet client()}{[e.browser, e.os, e.platform].filter(Boolean).join(", ")}{/snippet}
                  {@render row("Browser", client, e.browser && `browser:${e.browser}`)}
                {/if}
                {#if e.origin}
                  {#snippet origin()}{e.origin}{/snippet}
                  {@render row("Website", origin, `origin:${e.origin}`)}
                {/if}
                {#if e.lang}
                  {#snippet lang()}{filterValueLabel("lang", e.lang)}{/snippet}
                  {@render row("Language", lang, `lang:${e.lang}`)}
                {/if}
                {#if e.ua}
                  {#snippet ua()}<span class="text-xs text-muted-foreground">{e.ua}</span>{/snippet}
                  {@render row("User agent", ua)}
                {/if}
                {#if e.fp}
                  {#snippet fp()}
                    <span class="flex items-center gap-2">
                      <span class="min-w-0 truncate font-mono text-xs">{e.fp}</span>
                      <CopyButton text={e.fp} label="Copy visitor ID" size="icon-xs" class="ed-copy -my-1 ms-auto text-muted-foreground" />
                    </span>
                  {/snippet}
                  {@render row("Visitor ID", fp)}
                {/if}
              </dl>
            </section>

            {#if res.related.chain.length && !steps}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section("Same token")}
                {@render mini(res.related.chain.map((x) => ({ id: x.id, ts: x.ts, main: x, client: x, events: [x] })))}
              </section>
            {/if}

            {#if (v && v.solved + v.failed + v.blocked + v.limited > 0) || ipGroups.length}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4" aria-labelledby="ed-around">
                <h3 id="ed-around" class="pb-1.5 text-sm font-semibold">Around this event</h3>
                {#if v}
                  <dl class="flex flex-wrap gap-x-5 gap-y-1 pb-3 text-xs" aria-label="This visitor within a day of this event">
                    {#each [["Solved", v.solved, "text-foreground"], ["Failed", v.failed, "text-destructive"], ["Blocked", v.blocked, "text-destructive"], ["Rate limited", v.limited, "text-violet"]] as [label, n, tone] (label)}
                      <div class="flex items-baseline gap-1.5">
                        <dt class="text-muted-foreground">{label}</dt>
                        <dd class="font-medium tabular-nums {n ? tone : 'text-faint-foreground'}">{compact(n)}</dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
                {#if ipGroups.length}
                  <div class="relative mt-1 h-10" role="group" aria-label="Events from this IP over {span.label}">
                    <span class="absolute inset-x-0 top-4 h-px bg-border" aria-hidden="true"></span>
                    <span class="absolute top-1.5 h-5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style="left: {span.at}%" aria-hidden="true"></span>
                    {#each ipGroups as g, i (g.id)}
                      {@const d = groupDecision(g)}
                      <Tip side="top">
                        {#snippet content()}<span class="tabular-nums">{g.timedOut ? "Challenge expired" : g.events.length > 1 ? g.title : kindOf(g.main)[0]}, {d[0].toLowerCase()}, {ago(g.ts)}</span>{/snippet}
                        {#snippet children(props)}
                          <button
                            {...props}
                            type="button"
                            class="ed-dot absolute top-4 flex size-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            style="left: {pos(g.ts)}%; --i: {i}"
                            aria-label="{d[0]}, {ago(g.ts)}"
                            onclick={() => onopen(g.main.id, g)}
                          >
                            <span class="size-2 rounded-full ring-2 ring-popover {DOTS[d[0]] ?? 'bg-muted-foreground'}"></span>
                          </button>
                        {/snippet}
                      </Tip>
                    {/each}
                    <span class="absolute bottom-0 left-0 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">{span.from}</span>
                    <span class="absolute bottom-0 text-[11px] whitespace-nowrap text-muted-foreground {span.at > 82 ? '-translate-x-full' : span.at < 18 ? '' : '-translate-x-1/2'}" style="left: {span.at}%" aria-hidden="true">This event</span>
                    <span class="absolute right-0 bottom-0 text-[11px] text-muted-foreground tabular-nums {span.at > 82 ? 'hidden' : ''}" aria-hidden="true">{span.to}</span>
                  </div>
                  <h4 class="pt-4 pb-1 text-xs text-muted-foreground">Other events from this IP</h4>
                  {@render mini(ipSolves)}
                {/if}
              </section>
            {/if}

            <details class="group -mx-5 -mb-5 flex flex-col border-t border-border px-5 py-3">
              <summary
                class="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
              >
                <Icon name="right" size={14} class="text-muted-foreground transition-[rotate] duration-150 group-open:rotate-90 motion-reduce:transition-none" />
                Raw event
              </summary>
              <CodeBlock class="mt-2 mb-2" code={JSON.stringify(e, null, 2)} language="json" lineNumbers={false} download={false} />
            </details>
          </div>
        {:else}
          <div class="flex flex-col">
            {#if timedOut || !solve}
              <p class="pb-3">Someone on Chrome in Germany solved a challenge.</p>
            {/if}
            <div class="flex flex-wrap items-center gap-2 pb-5">
              <Button size="sm"><Icon name="ban" size={14} />Block this IP</Button>
              <Button size="sm"><Icon name="list" size={14} />Add to list</Button>
            </div>
            {#if solve}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section("This solve")}
                <ol class="-mx-2 flex flex-col">
                  {#each solve.events as x (x.id)}
                    <li class="flex items-start gap-3 px-2 py-1.5">
                      <span class="flex h-lh items-center"><span class="size-[18px] rounded-full"></span></span>
                      <span class="flex min-w-0 flex-1 flex-col">
                        <span>{kindOf(x)[0]}</span>
                        <span class="text-xs">example.com</span>
                      </span>
                      <span class="flex h-lh items-center text-xs tabular-nums">12:00:00 PM</span>
                    </li>
                  {/each}
                </ol>
              </section>
            {/if}
            <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
              {@render section("What happened")}
              <dl class="flex flex-col">
                {#each ["Browser", "Location", "Network", "Website"] as label (label)}
                  <div class="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-3 py-1.5">
                    <dt>{label}</dt>
                    <dd>Chrome on macOS</dd>
                  </div>
                {/each}
              </dl>
            </section>
          </div>
        {/if}
      </Skeleton>
    {/if}
  </div>
</Drawer>

{#if listCandidates}
  <AddToListModal candidates={listCandidates} onLists={ctx?.lists ?? []} onclose={() => (listCandidates = null)} />
{/if}

<style>
  @media (hover: hover) {
    .ed-dot:hover > span {
      scale: 1.5;
    }
    .ed-row :global(.ed-copy) {
      opacity: 0;
      transition: opacity 120ms ease-out;
    }
    .ed-row:hover :global(.ed-copy),
    .ed-row :global(.ed-copy:focus-visible),
    .ed-row :global(.ed-copy:has([data-copied])) {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .ed-swap {
      animation: ed-swap 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ed-facts {
      animation: ed-drop 200ms cubic-bezier(0.22, 1, 0.36, 1);
      transform-origin: top;
    }
    .ed-dot {
      animation: ed-pop 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(80ms + var(--i) * 20ms);
    }
    .ed-dot > span {
      transition: scale 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .ed-fill {
      animation: ed-fill 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
      animation-delay: calc(120ms + var(--i, 0) * 45ms);
    }
  }

  @keyframes ed-swap {
    from {
      opacity: 0;
      scale: 0.25;
      filter: blur(4px);
    }
  }

  @keyframes ed-drop {
    from {
      opacity: 0;
      translate: 0 -4px;
      scale: 1 0.98;
    }
  }

  @keyframes ed-pop {
    from {
      opacity: 0;
      scale: 0.4;
    }
  }

  @keyframes ed-fill {
    from {
      scale: 0 1;
    }
  }
</style>
