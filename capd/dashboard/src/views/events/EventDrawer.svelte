<script>
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import {
  Button,
  CodeBlock,
  Drawer,
  Icon,
  Menu,
  MenuItem,
  Skeleton,
  Tag,
  Tip,
} from "../../components/cap/index.js";
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
import { dtf, t } from "../../lib/i18n.svelte.js";
import { app } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import AddToListModal from "./AddToListModal.svelte";
import {
  eventSentence,
  failKind,
  filterValueLabel,
  groupSolves,
  isFlagged,
  verdictLabel,
} from "./labels.js";

let {
  open = $bindable(false),
  id,
  solve = null,
  timedOut = false,
  siteKey,
  onopen,
  onfilter,
} = $props();

let res = $state(null);
let missing = $state(false);
let blocked = $state(false);
let blocking = $state(false);
let listCandidates = $state(null);
let top = $state(null);
let openSteps = $state(new Set());

$effect(() => {
  const want = id;
  if (!want) return;
  res = null;
  missing = false;
  blocked = false;
  openSteps = new Set();
  scrollToTop(top);
  api("GET", `/keys/${siteKey}/events/${encodeURIComponent(want)}`).then(
    (r) => {
      if (want !== id) return;
      if (r?.event) res = r;
      else missing = true;
    },
  );
});

const DECISIONS = $derived({
  timeout: [
    t("Not solved"),
    "text-muted-foreground",
    "clock",
    "bg-muted text-muted-foreground",
  ],
  issued: [
    t("Issued"),
    "text-muted-foreground",
    "radar",
    "bg-info/12 text-info",
    true,
  ],
  pass: [
    t("Allowed"),
    "text-foreground",
    "check",
    "bg-success/12 text-success",
    true,
  ],
  flagged: [t("Flagged"), "text-warning", "flag", "bg-warning/15 text-warning"],
  fail: [
    t("Failed"),
    "text-muted-foreground",
    "ban",
    "bg-muted text-muted-foreground",
  ],
  failBad: [
    t("Failed"),
    "text-destructive",
    "ban",
    "bg-destructive/12 text-destructive",
  ],
  block: [
    t("Blocked"),
    "text-destructive",
    "ban",
    "bg-destructive/12 text-destructive",
  ],
  limit: [
    t("Rate limited"),
    "text-violet",
    "clock",
    "bg-violet/12 text-violet",
  ],
});
const KINDS = $derived({
  challenge: [t("Challenge issued"), "radar", "bg-info/12 text-info"],
  redeem: [t("Challenge solved"), "check", "bg-primary/12 text-primary"],
  siteverify: [t("Token verified"), "key", "bg-success/12 text-success"],
});
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
    ? [t("Request blocked"), "ban", "bg-destructive/12 text-destructive"]
    : x.outcome === "limit"
      ? [t("Too many requests"), "clock", "bg-violet/12 text-violet"]
      : x.outcome === "fail" && x.type === "redeem"
        ? [t("Solve failed"), "ban", "bg-muted text-muted-foreground"]
        : x.outcome === "fail" && x.type === "siteverify"
          ? [t("Verify failed"), "ban", "bg-muted text-muted-foreground"]
          : (KINDS[x.type] ?? [
              EVENT_TYPES[x.type] ?? x.type,
              "events",
              "bg-muted text-muted-foreground",
            ]);

const stepNote = (x) =>
  x.type === "challenge"
    ? (x.origin ?? "")
    : x.type === "redeem" && x.outcome === "pass" && x.solve_ms
      ? t("in {time}", { time: latency(x.solve_ms) })
      : x.type === "siteverify" && x.outcome === "pass"
        ? t("By your server")
        : x.reason
          ? reasonLabel(x.reason)
          : "";
const stepTime = dtf({
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const e = $derived(res?.event);
const steps = $derived.by(() => {
  if (!solve) return e && issued(e) ? [e] : null;
  const c = res?.related.challenge;
  return c && !solve.events.some((x) => x.type === "challenge")
    ? [c, ...solve.events]
    : solve.events;
});
const gap = $derived.by(() => {
  if (!steps) return null;
  const redeem = steps.find((x) => x.type === "redeem");
  if (!redeem)
    return timedOut
      ? [t("Not solved"), t("The challenge expired after 15 minutes")]
      : [
          t("Not solved yet"),
          t("The challenge is still waiting for a solution"),
        ];
  if (redeem.outcome === "pass" && !steps.some((x) => x.type === "siteverify"))
    return [t("Not verified"), t("Your server never checked this token")];
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
const ipSolves = $derived.by(() => {
  if (!res) return [];
  const own = new Set((steps ?? []).map((x) => x.id));
  return groupSolves(res.related.ip.filter((x) => !own.has(x.id))).slice(0, 12);
});
const PROTOCOLS = { hashwx: "HashWX", "sha256-pow": "SHA-256" };
const facts = (x) =>
  [
    [t("Time"), fullFmt.format(new Date(x.ts)), false],
    [t("Website"), x.origin, false],
    [t("Reason"), x.reason && reasonLabel(x.reason), false],
    [
      t("Solve time"),
      x.solve_ms != null && `${(x.solve_ms / 1000).toFixed(2)}s`,
      false,
    ],
    [t("Protocol"), x.protocol && (PROTOCOLS[x.protocol] ?? x.protocol), false],
    [t("Verdict"), x.verdict && verdictLabel(x.verdict), false],
    [
      t("Risk"),
      x.score != null &&
        t("{score} of 100", { score: Math.round(x.score * 100) }),
      false,
    ],
    [
      t("Signals"),
      x.flags?.length && x.flags.map((f) => signalInfo(f).text).join(", "),
      false,
    ],
    [t("Rule"), x.rule, false],
    [t("IP"), x.ip !== e?.ip && x.ip, true],
    [
      t("Browser"),
      x.ua !== e?.ua && [x.browser, x.os].filter(Boolean).join(", "),
      false,
    ],
    [t("Token"), x.token_id, true],
    [t("Event ID"), x.id, true],
  ].filter(([, v]) => v);
const scoreWord = (s) =>
  s >= 0.75
    ? t("looks automated")
    : s >= 0.4
      ? t("suspicious")
      : t("looks human");

const similar = $derived(
  e
    ? [
        e.ip && ["ip", e.ip, t("From this IP")],
        e.fp && ["fp", e.fp, t("From this visitor")],
        e.reason && ["reason", e.reason, t("With this reason")],
        e.asn_org && ["asn_org", e.asn_org, t("From this network")],
        e.country && [
          "country",
          e.country,
          t("From {value}", { value: filterValueLabel("country", e.country) }),
        ],
        e.agent && [
          "agent",
          e.agent,
          t("From {value}", { value: agentName(e.agent) }),
        ],
        e.browser && [
          "browser",
          e.browser,
          t("From {value}", { value: e.browser }),
        ],
      ].filter(Boolean)
    : [],
);

async function block() {
  blocking = true;
  const r = await api("POST", `/keys/${siteKey}/block-ip`, {
    type: "ip",
    value: e.ip,
  });
  blocking = false;
  if (!r.success) {
    toast(t(r.error || "Couldn't block this IP"), "error");
    return;
  }
  blocked = true;
  toast(t("Blocked {ip} on this key", { ip: e.ip }));
}
</script>

{#snippet row(label, value)}
  <div class="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-3 py-1.5">
    <dt class="text-xs text-muted-foreground">{label}</dt>
    <dd class="min-w-0 text-sm break-words tabular-nums">{@render value()}</dd>
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
      {@const d = g.timedOut ? DECISIONS.timeout : many ? (DECISIONS[g.decision === "fail" ? failKind(g.events.find((y) => y.outcome === "fail") ?? {}) : g.decision] ?? DECISIONS.pass) : decisionOf(x)}
      {@const quiet = !!d[4]}
      {@const origin = g.client.origin ? t("on {origin}", { origin: g.client.origin }) : ""}
      {@const note = many && x.type === "redeem" && x.outcome === "pass" && x.solve_ms ? `${t("in {time}", { time: latency(x.solve_ms) })}${origin ? ` ${origin}` : ""}` : x.type === "challenge" || many ? origin : x.type === "siteverify" && x.outcome === "pass" ? t("by your server") : stepNote(x)}
      <li>
        <button
          type="button"
          class="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted"
          onclick={() => onopen(x.id, g)}
        >
          <span class="min-w-0 flex-1 truncate">
            {g.timedOut ? t("Challenge expired") : many ? g.title : kindOf(x)[0]}
            {#if note}<span class="ms-1 text-muted-foreground">{note}</span>{/if}
          </span>
          {#if !quiet}<span class="shrink-0 text-xs font-medium {d[1]}">{d[0]}</span>{/if}
          <span class="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{ago(g.ts)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/snippet}

<Drawer
  bind:open
  title={!solve && !timedOut && e && issued(e) ? kind[0] : decision ? decision[0] : t("Event")}
  titleClass={!solve && !timedOut && e && issued(e) ? "" : decision ? decision[1] : ""}
  description={e ? (solve || issued(e) ? fullFmt.format(new Date(e.ts)) : `${kind[0]}, ${fullFmt.format(new Date(e.ts))}`) : t("Loading the event")}
>
  {#snippet lead()}
    {#if decision?.[2]}
      <span class="flex size-8 shrink-0 items-center justify-center rounded-lg {decision[3]}" aria-hidden="true">
        <Icon name={decision[2]} size={15} stroke={2.25} />
      </span>
    {/if}
  {/snippet}
  <div bind:this={top} class="flex flex-col text-sm">
    {#if missing}
      <p class="text-muted-foreground">{t("Cap no longer stores this event. Events older than the retention period are deleted.")}</p>
    {:else}
      <Skeleton loading={!e} label={t("Loading the event")}>
        {#if e}
          {@const v = res.related.visitor}
          {@const flags = e.flags ?? []}
          <div class="flex flex-col">
            {#if timedOut}
              <p class="pb-3 text-pretty">{t("Cap issued this challenge, but nothing solved it within 15 minutes, so it expired.")}</p>
            {:else if !solve && !issued(e)}
              <p class="pb-3 text-pretty">{eventSentence(e)}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-2 pb-5">
              {#if e.ip}
                <Button size="sm" class="text-destructive" disabled={blocked || blocking} onclick={block}>
                  <Icon name={blocked ? "check" : "ban"} size={14} />
                  {blocked ? t("Blocked") : t("Block this IP")}
                </Button>
                <Button
                  size="sm"
                  onclick={() =>
                    (listCandidates = [
                      { kind: "ip", value: e.ip },
                      ...(e.fp ? [{ kind: "visitor", value: e.fp }] : []),
                      ...(e.asn ? [{ kind: "asn", value: String(e.asn), label: e.asn_org }] : []),
                    ])}
                >
                  <Icon name="list" size={14} />
                  {t("Add to list")}
                </Button>
              {/if}
              {#if similar.length}
                <Menu width="w-60" align="start">
                  {#snippet trigger(props)}
                    <Button size="sm" {...props}>
                      {t("Show similar events")}
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
                {@render section(t("This solve"))}
                <ol class="-mx-2 flex flex-col">
                  {#each steps as x, i (x.id)}
                    {@const ok = x.outcome === "pass"}
                    {@const shown = openSteps.has(x.id)}
                    <li class="relative">
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
                          <span>{kindOf(x)[0]}</span>
                          {#if stepNote(x)}<span class="truncate text-xs text-muted-foreground">{stepNote(x)}</span>{/if}
                        </span>
                        <span class="flex h-lh items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                          {stepTime.format(new Date(x.ts))}
                          <Icon name="down" size={14} class="transition-[rotate] duration-150 motion-reduce:transition-none {shown ? 'rotate-180' : ''}" />
                        </span>
                      </button>
                      {#if shown}
                        <dl id="step-{x.id}" class="mb-1 ms-[2.375rem] me-2 flex flex-col rounded-lg bg-muted/60 px-3 py-1.5">
                          {#each facts(x) as [label, value, mono] (label)}
                            <div class="grid grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-3 py-1">
                              <dt class="text-xs text-muted-foreground">{label}</dt>
                              <dd class="min-w-0 text-xs break-words tabular-nums {mono ? 'font-mono' : ''}">{value}</dd>
                            </div>
                          {/each}
                        </dl>
                      {/if}
                    </li>
                  {/each}
                  {#if gap}
                    <li class="flex items-start gap-3 px-2 py-1.5 text-muted-foreground">
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
              <div class="flex items-center justify-between gap-3 pb-1.5">
                <h3 class="text-sm font-semibold">{t("What happened")}</h3>
                {#if e.score != null}
                  {@const pct = Math.round(e.score * 100)}
                  {@const parts = flags
                    .filter((f) => catalog.risk.weights[f] != null)
                    .map((f) => [signalInfo(f).text, Math.round(catalog.risk.weights[f] * 100), signalInfo(f).strength])
                    .sort((a, b) => b[1] - a[1])}
                  {@const capped = parts.length > 0 && parts.every((p) => p[2] !== "strong") && pct === Math.round(catalog.risk.weakCap * 100)}
                  {@const line = Math.round((app.key?.config?.behaviorThreshold ?? catalog.risk.threshold) * 100)}
                  {#snippet breakdown()}
                    <div class="flex w-64 flex-col gap-1.5 py-0.5 text-xs">
                      {#if parts.length}
                        {#each parts as [text, w], i (i)}
                          <div class="flex items-start justify-between gap-3">
                            <span class="text-pretty">{text}</span>
                            <span class="shrink-0 tabular-nums opacity-70">{w}</span>
                          </div>
                        {/each}
                        <div class="mt-0.5 flex justify-between gap-3 border-t border-current/15 pt-1.5">
                          <span>{t("Risk")}</span>
                          <span class="tabular-nums">{t("{score} of 100", { score: pct })}</span>
                        </div>
                      {:else}
                        <span>{t("No interaction flags, so the risk is {score}.", { score: pct })}</span>
                      {/if}
                      {#if capped}
                        <span class="opacity-70 text-pretty">{t("Only weak flags fired, so the risk stops at {score}.", { score: pct })}</span>
                      {/if}
                      <span class="opacity-70 text-pretty">{t("Flags combine as independent chances. This key blocks at {line}.", { line })}</span>
                    </div>
                  {/snippet}
                  <Tip content={breakdown} side="bottom" align="end">
                    {#snippet children(props)}
                  <span {...props} class="flex cursor-default items-center gap-2 text-xs text-muted-foreground" aria-label={t("Risk {score} of 100", { score: pct })}>
                    {scoreWord(e.score)}
                    <span class="relative inline-flex size-8 items-center justify-center">
                      <svg viewBox="0 0 32 32" class="absolute inset-0 -rotate-90" aria-hidden="true">
                        <circle cx="16" cy="16" r="14" fill="none" stroke="var(--border)" stroke-width="2.5" />
                        <circle
                          cx="16"
                          cy="16"
                          r="14"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          pathLength="100"
                          stroke-dasharray="{Math.max(pct, 1)} 100"
                          class={pct >= 70 ? "text-destructive" : pct >= 40 ? "text-warning" : "text-success"}
                        />
                      </svg>
                      <span class="relative text-[11px] font-medium text-foreground tabular-nums">{pct}</span>
                    </span>
                  </span>
                    {/snippet}
                  </Tip>
                {/if}
              </div>
              <dl class="flex flex-col">
                {#if e.reason}
                  {#snippet reason()}{reasonLabel(e.reason)}{/snippet}
                  {@render row(t("Reason"), reason)}
                {/if}
                {#if e.solve_ms != null}
                  {#snippet solve()}{(e.solve_ms / 1000).toFixed(2)}s{/snippet}
                  {@render row(t("Solve time"), solve)}
                {/if}
                {#if e.agent}
                  {#snippet agent()}
                    <span class="inline-flex items-center gap-2 align-middle"><AgentIcon id={e.agent} size={14} />{agentName(e.agent)}</span>
                    <span class="text-muted-foreground">{t("{level} confidence", { level: t(e.agent_confidence) })}{e.agent_verified ? t(", signature verified") : ""}</span>
                  {/snippet}
                  {@render row(t("AI agent"), agent)}
                {/if}
                {#if e.verdict}
                  {#snippet verdict()}{verdictLabel(e.verdict)}{/snippet}
                  {@render row(t("Verdict"), verdict)}
                {/if}
                {#if e.rule}
                  {#snippet rule()}{e.rule}{/snippet}
                  {@render row(t("Rule"), rule)}
                {/if}
                {#if e.protocol}
                  {#snippet protocol()}{({ hashwx: "HashWX", "sha256-pow": "SHA-256" })[e.protocol] ?? e.protocol}{/snippet}
                  {@render row(t("Protocol"), protocol)}
                {/if}
              </dl>
            </section>

            {#if flags.length}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section(t("Signals"))}
                <ul class="flex flex-wrap gap-1.5 pt-1">
                  {#each flags as f (f)}
                    {@const info = signalInfo(f)}
                    <li title={f}>
                      <Tag tone={info.strength === "strong" ? "warning" : "neutral"}>
                        {info.text}{#if info.strength === "strong"}<span class="sr-only">{t(", strong signal")}</span>{/if}
                      </Tag>
                    </li>
                  {/each}
                </ul>
              </section>
            {/if}

            <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
              {@render section(t("Visitor"))}
              <dl class="flex flex-col">
                {#if e.ip}
                  {#snippet ip()}
                    <span class="flex flex-wrap items-center gap-2">
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
                    </span>
                  {/snippet}
                  {@render row(t("IP"), ip)}
                {/if}
                {#if e.asn_org}
                  {#snippet net()}{e.asn_org} {#if e.asn}<span class="text-muted-foreground">AS{e.asn}</span>{/if}{/snippet}
                  {@render row(t("Network"), net)}
                {/if}
                {#if e.browser || e.os || e.platform}
                  {#snippet client()}{[e.browser, e.os, e.platform && t(e.platform)].filter(Boolean).join(", ")}{/snippet}
                  {@render row(t("Browser"), client)}
                {/if}
                {#if e.origin}
                  {#snippet origin()}{e.origin}{/snippet}
                  {@render row(t("Website"), origin)}
                {/if}
                {#if e.lang}
                  {#snippet lang()}{filterValueLabel("lang", e.lang)}{/snippet}
                  {@render row(t("Language"), lang)}
                {/if}
                {#if e.ua}
                  {#snippet ua()}<span class="text-xs text-muted-foreground">{e.ua}</span>{/snippet}
                  {@render row(t("User agent"), ua)}
                {/if}
                {#if e.fp}
                  {#snippet fp()}<span class="font-mono text-xs">{e.fp}</span>{/snippet}
                  {@render row(t("Visitor ID"), fp)}
                {/if}
              </dl>
            </section>

            {#if v}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                <div class="flex items-baseline justify-between gap-3 pb-3">
                  <h3 class="text-sm font-semibold">{t("This visitor")}</h3>
                  <span class="text-xs text-muted-foreground">{t("Within a day of this event")}</span>
                </div>
                <dl class="grid grid-cols-4 gap-2">
                  {#each [[t("Solved"), v.solved, ""], [t("Failed"), v.failed, v.failed ? "text-destructive" : ""], [t("Blocked"), v.blocked, v.blocked ? "text-destructive" : ""], [t("Rate limited"), v.limited, v.limited ? "text-violet" : ""]] as [label, n, tone] (label)}
                    <div class="flex flex-col gap-0.5 rounded-lg bg-muted/60 px-3 py-2.5">
                      <dt class="truncate text-xs text-muted-foreground">{label}</dt>
                      <dd class="text-lg font-semibold tabular-nums {tone}">{compact(n)}</dd>
                    </div>
                  {/each}
                </dl>
              </section>
            {/if}

            {#if res.related.chain.length && !steps}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section(t("Same token"))}
                {@render mini(res.related.chain.map((x) => ({ id: x.id, ts: x.ts, main: x, client: x, events: [x] })))}
              </section>
            {/if}

            {#if ipSolves.length}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section(t("Other events from this IP"))}
                {@render mini(ipSolves)}
              </section>
            {/if}

            <details class="group -mx-5 -mb-5 flex flex-col border-t border-border px-5 py-3">
              <summary
                class="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
              >
                <Icon name="right" size={14} class="text-muted-foreground transition-[rotate] duration-150 group-open:rotate-90 motion-reduce:transition-none" />
                {t("Raw event")}
              </summary>
              <CodeBlock class="mt-2 mb-2" code={JSON.stringify(e, null, 2)} language="json" lineNumbers={false} download={false} />
            </details>
          </div>
        {:else}
          <div class="flex flex-col">
            {#if timedOut || !solve}
              <p class="pb-3">{t("Someone on Chrome in Germany solved a challenge.")}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-2 pb-5">
              <Button size="sm"><Icon name="ban" size={14} />{t("Block this IP")}</Button>
              <Button size="sm"><Icon name="list" size={14} />{t("Add to list")}</Button>
            </div>
            {#if solve}
              <section class="-mx-5 flex flex-col border-t border-border px-5 py-4">
                {@render section(t("This solve"))}
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
              {@render section(t("What happened"))}
              <dl class="flex flex-col">
                {#each [t("Browser"), t("Location"), t("Network"), t("Website")] as label (label)}
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
  <AddToListModal candidates={listCandidates} onclose={() => (listCandidates = null)} />
{/if}
