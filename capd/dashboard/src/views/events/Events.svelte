<script>
import { onMount, untrack } from "svelte";
import {
  Button,
  Empty,
  Icon,
  PageHeader,
  RangePicker,
  Skeleton,
  Table,
  Tabs,
} from "../../components/cap/index.js";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  SlidingTabs,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Toggle,
} from "../../components/ui/index.js";
import { api, liveEvents, qs } from "../../lib/api.js";
import {
  agentName,
  loadCatalog,
  reasonLabel,
  signalInfo,
} from "../../lib/catalog.svelte.js";
import { compact, fullFmt, latency, timeFmt } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { dtf, numFmt, t, tp } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { scrollToTop } from "../../lib/utils.js";
import AsnIcon from "../activity/AsnIcon.svelte";
import WorldMap from "../activity/WorldMap.svelte";
import EventDrawer from "./EventDrawer.svelte";
import Histogram from "./Histogram.svelte";
import { CHALLENGE_TTL, failKind, groupSolves, isFlagged } from "./labels.js";
import SearchBar from "./SearchBar.svelte";

const RANGES = $derived([
  { id: "1h", short: "1h", label: t("Past hour"), long: t("the last hour") },
  {
    id: "24h",
    short: "1d",
    label: t("Past day"),
    long: t("the last 24 hours"),
  },
  {
    id: "7d",
    short: "7d",
    label: t("Past 7 days"),
    long: t("the last 7 days"),
  },
  {
    id: "30d",
    short: "30d",
    label: t("Past 30 days"),
    long: t("the last 30 days"),
  },
  {
    id: "90d",
    short: "90d",
    label: t("Past 90 days"),
    long: t("the last 90 days"),
  },
]);
const DECISIONS = $derived({
  issued: [t("Issued"), "text-muted-foreground"],
  timeout: [t("Not solved"), "text-muted-foreground"],
  pass: [t("Allowed"), "text-foreground"],
  flagged: [t("Flagged"), "font-medium text-warning"],
  fail: [t("Failed"), "font-medium text-muted-foreground"],
  failBad: [t("Failed"), "font-medium text-destructive"],
  block: [t("Blocked"), "font-medium text-destructive"],
  limit: [t("Rate limited"), "font-medium text-violet"],
});
const KINDS = $derived({
  challenge: [t("Challenge issued"), "radar", "bg-info/12 text-info"],
  redeem: [t("Challenge solved"), "check", "bg-primary/12 text-primary"],
  siteverify: [t("Token verified"), "key", "bg-success/12 text-success"],
});
const clock = dtf({
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const dayFmt = dtf({
  weekday: "short",
  month: "short",
  day: "numeric",
});
const dayOf = (ts) => new Date(ts).toDateString();
const decisionNote = (e) => {
  if (e.rule) return t("Matched a rule");
  if (e.agent) return agentName(e.agent);
  if (e.reason && e.reason !== "rate_limited") return reasonLabel(e.reason);
  if (e.flags?.length)
    return e.flags.length === 1
      ? signalInfo(e.flags[0]).text
      : t("{count} risk signals", { count: e.flags.length });
  return "";
};
const issued = (x) => x.type === "challenge" && x.outcome === "pass";
const failedKind = (x) =>
  x.outcome === "fail" && x.type === "redeem"
    ? [t("Solve failed"), "ban", "bg-muted text-muted-foreground"]
    : x.outcome === "fail" && x.type === "siteverify"
      ? [t("Verify failed"), "ban", "bg-muted text-muted-foreground"]
      : null;
const childNote = (e) =>
  e.type === "challenge"
    ? (e.origin ?? "")
    : e.type === "redeem" && e.outcome === "pass" && e.solve_ms
      ? t("in {time}", { time: latency(e.solve_ms) })
      : e.outcome !== "pass" && e.reason
        ? reasonLabel(e.reason)
        : "";
const kindNote = (e) => {
  if (e.type === "redeem" && e.outcome === "pass" && e.solve_ms)
    return t("Solved in {time}", { time: latency(e.solve_ms) });
  if (e.outcome === "fail")
    return e.origin ? t("on {origin}", { origin: e.origin }) : "";
  if (e.type === "siteverify") return t("From your server");
  return e.origin ?? "";
};
const PAGE = 60;

const sk = app.key.siteKey;
const n = (v) => numFmt(v ?? 0);

const splitPreset = (list) => {
  const pos = list.filter((f) => f.startsWith("outcome:"));
  if (pos.length !== 1) return { outcome: "all", rest: list };
  return {
    outcome: pos[0].slice(8),
    rest: list.filter((f) => f !== pos[0]),
  };
};

const initial = splitPreset(app.eventsPreset ?? []);
app.eventsPreset = null;

let range = $state("24h");
let outcome = $state(initial.outcome);
let filters = $state(initial.rest);
let q = $state("");
let expanded = $state(new Set());
let rows = $state([]);
let cursor = $state(null);
let trail = $state([null]);
let page = $state(0);
let before = $state([]);
let loading = $state(true);
let loadingMore = $state(false);
let overview = $state(null);
let custom = $state(null);
let live = $state(false);
let drawerId = $state(null);
let drawerGroup = $state(null);
let drawerOpen = $state(false);
let seq = 0;
let view = $state(
  (() => {
    try {
      return localStorage.getItem("cap_events_view") === "map" ? "map" : "list";
    } catch {
      return "list";
    }
  })(),
);
let where = $state(null);
let whereSeq = 0;

async function loadWhere() {
  const my = ++whereSeq;
  const res = await api(
    "GET",
    `/keys/${sk}/analytics/top${qs({ range, f: queryFilters, q, dims: "country,asn_org", limit: 100 })}`,
  );
  if (my !== whereSeq) return;
  where = res?.error ? { country: [], asn_org: [] } : res;
}

const setView = (v) => {
  view = v;
  try {
    localStorage.setItem("cap_events_view", v);
  } catch {}
  if (v === "map") loadWhere();
};

const pickCountry = (code) => {
  setView("list");
  addFilter(`country:${code}`);
};

const rangeInfo = $derived(RANGES.find((r) => r.id === range));
const flaggedOnly = $derived(outcome === "flagged");
const queryFilters = $derived(
  outcome === "all"
    ? filters
    : flaggedOnly
      ? [...filters, "outcome:pass", "type:redeem"]
      : [...filters, `outcome:${outcome}`],
);
const narrowed = $derived(outcome !== "all" || filters.length > 0 || !!q);
const summary = $derived(overview?.summary);
const COUNTS = {
  all: (x) => x.total,
  pass: (x) => x.challenges + x.solved + x.verified,
  flagged: (x) => x.flagged,
  fail: (x) => x.failed,
  block: (x) => x.blocked,
  limit: (x) => x.limited,
};
const total = $derived(summary ? (COUNTS[outcome]?.(summary) ?? 0) : 0);
const keep = (list) => (flaggedOnly ? list.filter(isFlagged) : list);

const solves = $derived(groupSolves(rows, Date.now() - CHALLENGE_TTL, before));
const sampleSolves = $derived(groupSolves(samples.events));

async function fetchPage(params, limit) {
  let res = await api(
    "GET",
    `/keys/${sk}/events${qs({ ...params, f: queryFilters, q, limit })}`,
  );
  let found = keep(res.events ?? []);
  let pages = 1;
  while (flaggedOnly && found.length < 20 && res.next && pages < 5) {
    res = await api(
      "GET",
      `/keys/${sk}/events${qs({ ...params, f: queryFilters, q, cursor: res.next, limit: 200 })}`,
    );
    found = [...found, ...keep(res.events ?? [])];
    pages++;
  }
  return { events: found, next: res.next ?? null };
}

async function load() {
  const my = ++seq;
  custom = null;
  loading = true;
  await loadCatalog();
  const params = { range, f: filters, q };
  const [res, o] = await Promise.all([
    fetchPage({ range }, flaggedOnly ? 200 : PAGE),
    api("GET", `/keys/${sk}/analytics${qs(params)}`),
  ]);
  if (my !== seq) return;
  rows = res.events;
  cursor = res.next;
  trail = [null];
  page = 0;
  before = [];
  overview = o?.series ? o : null;
  loading = false;
  if (view === "map") loadWhere();
}

async function goPage(i) {
  const my = seq;
  const at = i > page ? cursor : trail[i];
  loadingMore = true;
  const res = await fetchPage(
    at ? { range, cursor: at } : { range },
    flaggedOnly ? 200 : PAGE,
  );
  const top = res.events?.[0]?.ts;
  const near =
    i && top
      ? await api(
          "GET",
          `/keys/${sk}/events${qs({ from: top + 1, to: top + CHALLENGE_TTL, f: ["type:redeem"], limit: 200 })}`,
        )
      : null;
  loadingMore = false;
  if (my !== seq) return;
  before = near?.events ?? [];
  if (i > page) trail = [...trail.slice(0, i), at];
  rows = res.events;
  cursor = res.next;
  page = i;
  expanded = new Set();
  scrollToTop(document.getElementById("evTable"));
}

async function pickBucket(from, to) {
  const my = ++seq;
  loading = true;
  custom = { from, to };
  const res = await api(
    "GET",
    `/keys/${sk}/events${qs({ from, to, f: queryFilters, q, limit: 200 })}`,
  );
  if (my !== seq) return;
  rows = keep(res.events ?? []);
  cursor = null;
  loading = false;
}

const setFilters = (next) => {
  filters = next;
  load();
};

const addFilter = (f) => {
  const { outcome: o, rest } = splitPreset([f]);
  if (o !== "all" && !rest.length) {
    outcome = o;
    load();
    return;
  }
  if (!filters.includes(f)) setFilters([...filters, f]);
};

const resetAll = () => {
  outcome = "all";
  q = "";
  setFilters([]);
};

onMount(load);

$effect(() => {
  const preset = app.eventsPreset;
  if (!preset) return;
  app.eventsPreset = null;
  untrack(() => {
    const next = splitPreset(preset);
    outcome = next.outcome;
    filters = next.rest;
    q = "";
    load();
  });
});

$effect(() => {
  if (!live) return;
  let busy = false;
  let again = false;
  const pull = async () => {
    if (custom || loading || page) return;
    if (document.hidden) {
      again = true;
      return;
    }
    if (busy) {
      again = true;
      return;
    }
    busy = true;
    again = false;
    const my = seq;
    const newest = rows[0]?.ts ?? Date.now() - 60_000;
    const res = await api(
      "GET",
      `/keys/${sk}/events${qs({ from: newest, to: Date.now() + 60_000, f: queryFilters, q, limit: 100 })}`,
    );
    busy = false;
    if (my === seq) {
      const known = new Set(rows.map((r) => r.id));
      const fresh = keep(res.events ?? [])
        .filter((e) => !known.has(e.id))
        .map((e) => ({ ...e, fresh: true }));
      if (fresh.length) rows = [...fresh, ...rows].slice(0, 500);
    }
    if (again) pull();
  };
  const visible = () => {
    if (!document.hidden && again) pull();
  };
  document.addEventListener("visibilitychange", visible);
  const stop = liveEvents(sk, pull);
  return () => {
    stop();
    document.removeEventListener("visibilitychange", visible);
  };
});

function openDrawer(id, found) {
  const g = found ?? solves.find((x) => x.events.some((y) => y.id === id));
  drawerGroup = g ?? null;
  drawerId = g && g.events.length > 1 ? g.main.id : id;
  drawerOpen = true;
}

const rowClick = (id) => (node) => {
  const handler = (ev) => {
    if (ev.target.closest("button, a") || getSelection()?.toString()) return;
    openDrawer(id);
  };
  node.addEventListener("click", handler);
  return () => node.removeEventListener("click", handler);
};
</script>

{#snippet ring(score)}
  {@const tone = score >= 70 ? "text-destructive" : score >= 40 ? "text-warning" : "text-muted-foreground/60"}
  <span class="relative inline-flex size-7 items-center justify-center" title={t("Risk {score} of 100", { score })}>
    <svg viewBox="0 0 28 28" class="absolute inset-0 -rotate-90" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="none" stroke="var(--border)" stroke-width="2.5" />
      <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" pathLength="100" stroke-dasharray="{Math.max(score, 1)} 100" class={tone} />
    </svg>
    <span class="relative text-[10px] font-medium tabular-nums">{score}</span>
  </span>
{/snippet}

{#snippet steps(g)}
  {@const r = g.events.find((x) => x.type === "redeem")}
  {@const c = g.events.find((x) => x.type === "challenge")}
  {@const note = [r?.outcome === "pass" && r.solve_ms && t("in {time}", { time: latency(r.solve_ms) }), (c ?? r)?.origin && t("on {origin}", { origin: (c ?? r).origin })].filter(Boolean).join(" ")}
  {#if note}<span class="truncate text-xs text-muted-foreground max-sm:hidden">{note}</span>{/if}
{/snippet}

{#snippet line(e, g, child, open)}
  {@const selected = drawerOpen && drawerId === e.id}
  {@const d0 = g?.timedOut ? "timeout" : (g ? g.events.every(issued) : issued(e)) ? "issued" : g ? g.decision : isFlagged(e) ? "flagged" : e.outcome}
  {@const d = d0 === "fail" ? failKind((g?.events ?? [e]).find((x) => x.outcome === "fail") ?? e) : d0}
  {@const decision = DECISIONS[d] ?? [d, "text-foreground"]}
  {@const kind = g?.timedOut ? [t("Challenge expired"), "clock", "bg-muted text-faint-foreground"] : e.outcome === "block" ? [t("Request blocked"), "ban", "bg-destructive/12 text-destructive"] : e.outcome === "limit" ? [t("Too many requests"), "clock", "bg-violet/12 text-violet"] : failedKind(e) ?? (KINDS[e.type] ?? [e.type, "events", "bg-muted text-muted-foreground"])}
  {@const score = e.score == null ? null : Math.round(e.score * 100)}
  {@const note = g?.timedOut ? t("Expired after 15 minutes") : decisionNote(e)}
  {@const who = g ? g.client : e}
  <TableRow
    data-clickable
    data-state={selected ? "selected" : undefined}
    class="cursor-pointer {child ? 'bg-muted/40' : ''} {e.fresh
      ? 'transition-[background-color] duration-1000 starting:bg-primary/10'
      : ''}"
    {@attach rowClick(e.id)}
  >
    <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums max-sm:hidden" title={fullFmt.format(new Date(e.ts))}>
      <span class="flex items-center gap-1.5">
        {#if g && g.events.length > 1}
          <button
            type="button"
            class="-ms-[22px] flex size-6 shrink-0 cursor-pointer md:-ms-[30px] items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-muted [@media(hover:hover)]:hover:text-foreground"
            aria-expanded={open}
            aria-label={open ? t("Hide the {count} events in this solve", { count: g.events.length }) : t("Show the {count} events in this solve", { count: g.events.length })}
            onclick={() => {
              const next = new Set(expanded);
              if (open) next.delete(g.id);
              else next.add(g.id);
              expanded = next;
            }}
          >
            <Icon name="right" size={12} class="transition-transform duration-150 {open ? 'rotate-90' : ''}" />
          </button>
        {:else}
          <span class="-ms-[22px] size-6 shrink-0 md:-ms-[30px]" aria-hidden="true"></span>
        {/if}
        {clock.format(new Date(g ? g.ts : e.ts))}
      </span>
    </TableCell>
    <TableCell class="whitespace-nowrap max-sm:hidden">
      {#if !child}
        <span class="block {decision[1]}">{decision[0]}</span>
        {#if note}<span class="block max-w-44 truncate text-xs text-muted-foreground" title={note}>{note}</span>{/if}
      {/if}
    </TableCell>
    <TableCell class="py-1.5! max-md:hidden">{#if score != null && !child}{@render ring(score)}{/if}</TableCell>
    <TableCell class="w-full max-w-0">
      <button
        type="button"
        class="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring {child ? 'ps-[38px]' : ''}"
        onclick={() => openDrawer(e.id)}
      >
        <span class="flex size-7 {child ? 'hidden' : ''} shrink-0 items-center justify-center rounded-md {kind[2]}" aria-hidden="true">
          <Icon name={kind[1]} size={14} stroke={2.25} />
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate">{g && g.events.length > 1 && !g.timedOut ? g.title : kind[0]}</span>
          {#if g && g.events.length > 1}
            {@render steps(g)}
          {:else if child}
            {#if childNote(e)}<span class="truncate text-xs text-muted-foreground max-sm:hidden">{childNote(e)}</span>{/if}
          {:else if kindNote(e)}
            <span class="truncate text-xs text-muted-foreground max-sm:hidden">{kindNote(e)}</span>
          {/if}
          <span class="truncate text-xs sm:hidden"><span class={decision[1]}>{decision[0]}</span><span class="text-muted-foreground">, {clock.format(new Date(e.ts))}</span></span>
        </span>
      </button>
    </TableCell>
    <TableCell class="whitespace-nowrap max-md:hidden">
      {#if child}
      {:else if who.ip && who.type !== "siteverify"}
        <span class="flex min-w-0 flex-col">
          <button
            type="button"
            class="cursor-pointer self-start rounded-sm font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
            title={t("Show only events from {value}", { value: who.ip })}
            onclick={() => addFilter(`ip:${who.ip}`)}
          >{who.ip}</button>
          {#if who.browser}<span class="text-xs text-muted-foreground">{who.os ? t("{browser} on {os}", { browser: who.browser, os: who.os }) : who.browser}</span>{/if}
        </span>
      {:else}
        <span class="text-muted-foreground">{who.type === "siteverify" ? t("Your server") : t("No IP")}</span>
      {/if}
    </TableCell>
    <TableCell class="whitespace-nowrap max-lg:hidden">
      {#if child}
      {:else if who.country}
        <span class="flex items-center gap-2.5">
          {#if flagUrl(who.country)}
            <img
              src={flagUrl(who.country)}
              alt=""
              class="size-5 shrink-0 rounded-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              width="20"
              height="20"
              onerror={(ev) => (ev.currentTarget.style.visibility = "hidden")}
            />
          {/if}
          <span class="flex min-w-0 flex-col">
            <button
              type="button"
              class="cursor-pointer self-start rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
              title={t("Show only events from {value}", { value: countryName(who.country) })}
              onclick={() => addFilter(`country:${who.country}`)}
            >{countryName(who.country)}</button>
            {#if who.asn_org}
              <button
                type="button"
                class="max-w-48 cursor-pointer self-start truncate rounded-sm text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
                title={t("Show only events from {value}", { value: who.asn_org })}
                onclick={() => addFilter(`asn_org:${who.asn_org}`)}
              >{who.asn_org}</button>
            {/if}
          </span>
        </span>
      {:else}
        <span class="text-faint-foreground">{t("Unknown")}</span>
      {/if}
    </TableCell>
  </TableRow>
{/snippet}

<PageHeader title={t("Events")}>
  {#snippet actions()}
  <div class="flex items-center" role="group" aria-label={t("Live updates and time range")}>
      <Toggle variant="outline" size="lg" class="-me-px rounded-s-[calc(var(--radius)-4px)] rounded-e-none focus-visible:z-10" bind:pressed={live} title={live ? t("Stop following new events") : t("Show new events as they come in")}>
        <span class="relative flex size-2">
          {#if live}<span class="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:hidden"></span>{/if}
          <span class="relative size-2 rounded-full {live ? 'bg-success' : 'bg-faint-foreground'}"></span>
        </span>
        {t("Live")}
      </Toggle>
      <RangePicker
        class="rounded-s-none rounded-e-[calc(var(--radius)-4px)]"
        value={range}
        ranges={RANGES}
        onchange={(id) => {
          range = id;
          load();
        }}
      />
    </div>
  {/snippet}
</PageHeader>

<div class="sticky top-12 z-10 bg-background md:top-0 md:-mt-11 md:pt-11">
<div class="px-4 pt-4 pb-2 md:px-5">
  <div>
    <label for="evSearch" class="sr-only">{t("Search events")}</label>
    <SearchBar
      {filters}
      query={q}
      onadd={addFilter}
      onremove={(f) => setFilters(filters.filter((x) => x !== f))}
      ontoggle={(f) => {
        const neg = f.startsWith("-");
        setFilters(filters.map((x) => (x === f ? (neg ? f.slice(1) : `-${f}`) : x)));
      }}
      onquery={(v) => {
        if (v === q) return;
        q = v;
        load();
      }}
    />
  </div>
</div>

<Tabs
  class="px-4 md:px-8"
  label={t("Outcome")}
  bind:value={outcome}
  onchange={load}
  items={[
    { id: "all", label: t("All events"), count: summary && compact(COUNTS.all(summary)) },
    { id: "pass", label: t("Allowed"), count: summary && compact(COUNTS.pass(summary)) },
    { id: "flagged", label: t("Flagged"), count: summary && compact(COUNTS.flagged(summary)) },
    { id: "fail", label: t("Failed"), count: summary && compact(COUNTS.fail(summary)) },
    { id: "block", label: t("Blocked"), count: summary && compact(COUNTS.block(summary)) },
    { id: "limit", label: t("Rate limited"), count: summary && compact(COUNTS.limit(summary)) },
  ]}
>
  {#snippet aside()}
    <span class="me-2 text-sm text-muted-foreground max-sm:sr-only">{t("View by")}</span>
    <SlidingTabs
      tabs={[{ id: "list", label: t("List") }, { id: "map", label: t("Map") }]}
      bind:value={() => view, setView}
      flat
      class="rounded-lg bg-foreground/6 p-0.5"
      pillClass="rounded-md bg-background shadow-[0_0_0_1px_var(--border)]"
      activeTabClass="text-foreground"
      tabClass="rounded-md px-2.5 py-1 text-sm"
    />
  {/snippet}
</Tabs>
</div>

<div class="px-4 pt-5 pb-4 md:px-5">
  <Skeleton data={overview} sample={samples.overview} label={t("Loading chart")}>
    {#snippet children(o)}
      <Histogram
        height={110}
        series={o.series}
        bucket={o.range.bucket}
        active={flaggedOnly ? "flagged" : null}
        onpick={pickBucket}
      />
    {/snippet}
  </Skeleton>
</div>

{#if custom}
  <div class="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-2 md:px-5" role="status">
    <p class="me-auto text-sm tabular-nums">
      <span class="font-semibold">{loading ? t("Loading") : tp(rows.length, "{total} event", "{total} events", { total: n(rows.length) })}</span>
      <span class="text-muted-foreground">{t("from {from} to {to}", { from: fullFmt.format(new Date(custom.from)), to: timeFmt.format(new Date(custom.to)) })}</span>
    </p>
    <Button size="sm" onclick={load}>
      <Icon name="left" size={13} />
      {t("Back to {range}", { range: rangeInfo.long })}
    </Button>
  </div>
{/if}

{#if view === "map"}
  <Skeleton class="border-t border-border" data={where} sample={samples.where} label={t("Loading map")}>
    {#snippet children(w)}
      {@const countries = w.country ?? []}
      <div class="flex flex-col gap-5 px-4 pt-5 pb-10 md:px-5">
        {#if !countries.length}
          <Empty title={t("No locations")}>{t("Nothing that matches has a country. Turn on visitor location in instance settings, or widen the search.")}</Empty>
        {:else}
          <WorldMap
            values={Object.fromEntries(countries.map((r) => [r.value, r.n]))}
            describe={(code) => {
              const r = countries.find((x) => x.value === code);
              return r ? t("{count} events", { count: n(r.n) }) : "";
            }}
            onpick={pickCountry}
          />
          <div class="grid gap-6 md:grid-cols-2">
            {#each [[t("Countries"), countries, "country"], [t("Networks"), w.asn_org ?? [], "asn_org"]] as [title, list, field] (field)}
              {@const top = Math.max(1, ...list.map((r) => r.n))}
              <section aria-label={title}>
                <h2 class="mb-1.5 flex px-2 text-xs font-medium text-muted-foreground">
                  <span class="me-auto">{title}</span><span>{t("Events")}</span>
                </h2>
                <ul class="flex flex-col gap-0.5">
                  {#each list.slice(0, 10) as r (r.value)}
                    <li>
                      <button
                        type="button"
                        class="relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
                        onclick={() => (field === "country" ? pickCountry(r.value) : (setView("list"), addFilter(`asn_org:${r.value}`)))}
                      >
                        <span class="absolute inset-y-0 start-0 rounded-md bg-foreground/[0.06]" style:width="{Math.max(1.5, (r.n / top) * 100)}%"></span>
                        {#if field === "country"}
                          {#if flagUrl(r.value)}<img src={flagUrl(r.value)} alt="" class="relative h-3.5 w-[18px] rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" width="18" height="14" />{/if}
                          <span class="relative truncate">{countryName(r.value) || r.value}</span>
                        {:else}
                          <span class="relative flex size-4 shrink-0 items-center justify-center"><AsnIcon asn={r.label} /></span>
                          <span class="relative truncate">{r.value}</span>
                        {/if}
                        <span class="relative ms-auto font-medium tabular-nums">{compact(r.n)}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              </section>
            {/each}
          </div>
        {/if}
      </div>
    {/snippet}
  </Skeleton>
{:else}
  <Skeleton data={loading && !rows.length ? null : solves} sample={sampleSolves} empty={!loading && !rows.length} preload={[...new Set(rows.map((r) => flagUrl(r.country)))]} label={t("Loading events")}>
    {#snippet emptyMessage()}
      <div class="border-t border-border px-4 md:px-5">
        <Empty title={custom ? t("Nothing in this slice") : narrowed ? t("No events match") : t("No events yet")}>
          {#if custom}
            {t("Go back to the full range to see the rest.")}
          {:else if narrowed}
            {t("Nothing in {range} matches this search. Remove a filter or pick a longer range.", { range: rangeInfo.long })}
          {:else}
            {t("Events show up here as soon as the widget on your site asks for a challenge.")}
          {/if}
          {#snippet action()}
            {#if custom}
              <Button size="sm" onclick={load}>{t("Back to {range}", { range: rangeInfo.long })}</Button>
            {:else if narrowed}
              <Button size="sm" onclick={resetAll}>{t("Clear search and filters")}</Button>
            {:else}
              <Button size="sm" onclick={() => navigate({ view: "key", siteKey: sk, tab: "configuration" })}>{t("Set up the widget")}</Button>
            {/if}
          {/snippet}
        </Empty>
      </div>
    {/snippet}
    {#snippet children(list)}
      <Table flush id="evTable" class="scroll-mt-40 border-t md:scroll-mt-28 border-border transition-opacity duration-200 {loading && rows.length ? 'opacity-60' : ''}">
        <TableHeader class="max-sm:hidden">
          <TableRow>
            <TableHead class="w-px max-sm:hidden">{t("Time")}</TableHead>
            <TableHead class="w-px max-sm:hidden">{t("Decision")}</TableHead>
            <TableHead class="w-px max-md:hidden" title={t("Risk score from 0 to 100")}>{t("Risk")}</TableHead>
            <TableHead>{t("Event")}</TableHead>
            <TableHead class="max-md:hidden">{t("Visitor")}</TableHead>
            <TableHead class="max-lg:hidden">{t("Location")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-busy={loading}>
          {#each list as g, i (g.id)}
            {@const open = expanded.has(g.id)}
            {#if !i || dayOf(list[i - 1].ts) !== dayOf(g.ts)}
              <TableRow class="bg-muted/50 hover:bg-muted/50"><TableCell colspan="6" class="h-9 text-xs text-muted-foreground">{dayFmt.format(new Date(g.ts))}</TableCell></TableRow>
            {/if}
            {@render line(g.main, g, false, open)}
            {#if open}
              {#each g.events as e (e.id)}{@render line(e, null, true, false)}{/each}
            {/if}
          {/each}
        </TableBody>
      </Table>

      {#if !custom}
        <div class="flex items-center gap-3 border-t border-border px-4 py-3 text-sm md:px-5">
          <span class="me-auto text-muted-foreground tabular-nums">
            {#if flaggedOnly}{t("Page {page}", { page: page + 1 })}{:else}{t("{from} to {to} of {total}", { from: n(page * PAGE + 1), to: n(page * PAGE + rows.length), total: n(total) })}{/if}
          </span>
          <Pagination class="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious disabled={!page || loadingMore} onclick={() => goPage(page - 1)} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext disabled={!cursor || loadingMore} onclick={() => goPage(page + 1)} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      {/if}
    {/snippet}
  </Skeleton>
{/if}

<EventDrawer
  bind:open={drawerOpen}
  id={drawerId}
  solve={drawerGroup?.events.length > 1 ? drawerGroup : null}
  timedOut={drawerGroup?.timedOut}
  siteKey={sk}
  onopen={openDrawer}
  onfilter={(f) => {
    drawerOpen = false;
    addFilter(f);
  }}
/>
