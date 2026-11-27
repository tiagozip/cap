<script>
import { onMount, untrack } from "svelte";
import AgentIcon from "../../components/cap/AgentIcon.svelte";
import {
  Bone,
  Button,
  PageHeader,
  RangePicker,
  Skeleton,
} from "../../components/cap/index.js";
import Odometer from "../../components/cap/Odometer.svelte";
import Icon from "../../components/Icon.svelte";
import {
  Card,
  CardContent,
  SlidingTabs,
  ToggleGroup,
  ToggleGroupItem,
} from "../../components/ui/index.js";
import { api, liveEvents, qs } from "../../lib/api.js";
import {
  agentName,
  loadCatalog,
  reasonLabel,
  signalInfo,
} from "../../lib/catalog.svelte.js";
import { compact, latency } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import {
  app,
  hasGeoSource,
  navigate,
  openEvents,
} from "../../lib/state.svelte.js";
import AsnIcon from "./AsnIcon.svelte";
import Breakdown from "./Breakdown.svelte";
import OsIcon from "./OsIcon.svelte";
import Panel from "./Panel.svelte";
import TrafficChart from "./TrafficChart.svelte";

const RANGES = [
  { id: "24h", short: "1d", label: "Past day", long: "the last 24 hours" },
  { id: "7d", short: "7d", label: "Past 7 days", long: "the last 7 days" },
  { id: "30d", short: "30d", label: "Past 30 days", long: "the last 30 days" },
  { id: "90d", short: "90d", label: "Past 90 days", long: "the last 90 days" },
];

const METRICS = [
  {
    id: "challenges",
    label: "Challenges",
    color: "var(--chart-1)",
    chart: true,
    view: "View challenges",
    filters: ["type:challenge"],
  },
  {
    id: "solved",
    label: "Passed",
    color: "var(--success)",
    chart: true,
    view: "View passed solves",
    filters: ["type:redeem", "outcome:pass"],
  },
  {
    id: "flagged",
    label: "Flagged",
    color: "var(--warning)",
    chart: true,
    bad: true,
    view: "View flagged solves",
    filters: ["outcome:flagged"],
  },
  {
    id: "blocked",
    label: "Blocked",
    color: "var(--destructive)",
    chart: true,
    bad: true,
    view: "View blocked events",
    filters: ["outcome:block"],
  },
  {
    id: "failed",
    label: "Failed",
    color: "var(--faint-foreground)",
    chart: true,
    bad: true,
    view: "View failed events",
    filters: ["outcome:fail"],
  },
];

const onboarding = import("./Onboarding.svelte");
const worldMap = import("./WorldMap.svelte");
const moversView = import("../../polish/overview/Movers.svelte");
const sharedView = import("./SharedClients.svelte");
const panels = import("../../polish/overview/panels.js");

const DIMS =
  "country,asn_org,flag,agent,reason,browser,os,platform,origin,lang";

const siteKey = app.key.siteKey;
const stored = (() => {
  try {
    return localStorage.getItem("cap_overview_range");
  } catch {
    return null;
  }
})();

let range = $state(RANGES.some((r) => r.id === stored) ? stored : "7d");
let metric = $state("challenges");
let compare = $state(
  (() => {
    try {
      return localStorage.getItem("cap_overview_compare") === "1";
    } catch {
      return false;
    }
  })(),
);
const toggleCompare = () => {
  compare = !compare;
  try {
    localStorage.setItem("cap_overview_compare", compare ? "1" : "0");
  } catch {}
};
let metricGroup = $state(null);
let pill = $state(null);

$effect(() => {
  metric;
  const group = metricGroup;
  if (!group) return;
  const place = () => {
    const on = group.querySelector('[data-state="on"]');
    pill = on
      ? {
          x: on.offsetLeft,
          y: on.offsetTop,
          w: on.offsetWidth,
          h: on.offsetHeight,
          ready: untrack(() => pill) != null,
        }
      : null;
  };
  place();
  const ro = new ResizeObserver(place);
  ro.observe(group);
  return () => ro.disconnect();
});
let data = $state(null);
let top = $state(null);
let pair = $state(null);
let pairing = $state(false);
let insights = $state(null);
let mapMetric = $state("volume");
let peek = $state(null);
let heatMode = $state("all");
let live = $state(null);
let loading = $state(true);
let seq = 0;

loadCatalog();

const rangeInfo = $derived(RANGES.find((r) => r.id === range));
const summary = $derived(data?.summary);
const previous = $derived(data?.previous);
const geo = $derived(hasGeoSource());
const total = $derived(summary?.total ?? 0);

const delta = (cur, prev) => {
  if (prev == null || (!cur && !prev)) return null;
  if (!prev) return { up: true, text: "New" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return {
    up: pct > 0,
    flat: pct === 0,
    text: pct ? `${Math.abs(pct)}%` : "No change",
  };
};

const nf = new Intl.NumberFormat();
const n = (v) => nf.format(v ?? 0);

async function load(next = range) {
  const id = ++seq;
  loading = true;
  const params = qs({ range: next });
  const [overview, dims, extra] = await Promise.all([
    api("GET", `/keys/${siteKey}/analytics${params}`),
    api(
      "GET",
      `/keys/${siteKey}/analytics/top${qs({ range: next, dims: DIMS, limit: 60 })}`,
    ),
    api("GET", `/keys/${siteKey}/analytics/insights${params}`),
  ]);
  if (id !== seq) return;
  loading = false;
  lastQuiet = Date.now();
  if (!overview?.error) data = overview;
  if (!dims?.error) top = dims;
  if (!extra?.error) insights = extra;
  const r = overview?.range;
  if (!r || !overview.previous || dims?.error) {
    pair = null;
    return;
  }
  pairing = true;
  const before = await api(
    "GET",
    `/keys/${siteKey}/analytics/top${qs({ from: r.from - (r.to - r.from), to: r.from, dims: DIMS, limit: 60 })}`,
  );
  if (id !== seq) return;
  pairing = false;
  pair = before?.error
    ? null
    : {
        now: flat(tabsFor(dims)),
        before: flat(tabsFor(before)),
        totals: [overview.summary?.total ?? 0, overview.previous.total ?? 0],
      };
}

const QUIET = { "24h": 10_000, "7d": 30_000, "30d": 60_000, "90d": 120_000 };
let lastQuiet = Date.now();
let quietRuns = 0;
async function refresh() {
  if (loading || Date.now() - lastQuiet < QUIET[range]) return;
  lastQuiet = Date.now();
  const id = seq;
  const res = await api("GET", `/keys/${siteKey}/analytics${qs({ range })}`);
  if (id === seq && !loading && !res?.error) data = res;
  if (++quietRuns % 3) return;
  const more = await api(
    "GET",
    `/keys/${siteKey}/analytics/insights${qs({ range })}`,
  );
  if (id === seq && !loading && !more?.error) insights = more;
}

let pulsing = false;
let lastPulse = 0;
async function pulse() {
  if (document.hidden || pulsing || Date.now() - lastPulse < 1000) return;
  pulsing = true;
  lastPulse = Date.now();
  try {
    const res = await api(
      "GET",
      `/keys/${siteKey}/analytics${qs({ range: "1h" })}`,
    );
    if (!res?.error) {
      live = res.summary?.challenges ?? 0;
    }
  } finally {
    pulsing = false;
  }
  refresh();
}

const drill = (filters) => openEvents([...filters, `range:${range}`]);

const setRange = (id) => {
  if (id === range) return;
  range = id;
  try {
    localStorage.setItem("cap_overview_range", id);
  } catch {}
  load(id);
};

onMount(() => {
  load();
  pulse();
  const timer = setInterval(pulse, 30_000);
  const stopLive = liveEvents(siteKey, pulse);
  return () => {
    clearInterval(timer);
    stopLive();
  };
});

const onKeydown = (e) => {
  if (
    e.defaultPrevented ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.isComposing ||
    e.target.closest?.(
      "input, textarea, select, [contenteditable]:not([contenteditable=false])",
    ) ||
    document.querySelector(
      "[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=menu][data-state=open], [role=listbox]:not([hidden])",
    )
  )
    return;
  const pick = METRICS[Number(e.key) - 1];
  if (pick) {
    e.preventDefault();
    metric = pick.id;
    return;
  }
  const step = { "[": -1, "]": 1 }[e.key];
  if (!step) return;
  const at = RANGES.findIndex((r) => r.id === range) + step;
  if (!RANGES[at]) return;
  e.preventDefault();
  setRange(RANGES[at].id);
};

const named = (fn) => (r) => fn(r.value) || r.value;

const tabsFor = (t) => ({
  locations: [
    {
      id: "countries",
      label: "Countries",
      column: "Country",
      field: "country",
      rows: t?.country,
      name: named(countryName),
      icon: flagIcon,
      image: (r) => flagUrl(r.value),
      risk: true,
      empty: "No location data in this period",
      body: !geo && t?.country?.length === 0 ? geoOff : undefined,
    },
    {
      id: "networks",
      label: "Networks",
      column: "Network",
      field: "asn_org",
      rows: t?.asn_org,
      name: (r) => r.value,
      icon: asnIcon,
      risk: true,
      empty: "No network data in this period",
      body: !geo && t?.asn_org?.length === 0 ? geoOff : undefined,
    },
  ],
  threats: [
    {
      id: "flags",
      label: "Risk flags",
      column: "Signal",
      field: "flag",
      rows: t?.flag?.filter((r) => !r.value.startsWith("rule:")),
      name: (r) => signalInfo(r.value).text,
      risk: true,
      empty:
        "No risk flags in this period. Requests that trip a detection check show up here.",
    },
    {
      id: "agents",
      label: "AI agents",
      column: "Agent",
      field: "agent",
      rows: t?.agent,
      name: (r) => agentName(r.value),
      icon: agentIcon,
      risk: true,
      empty: "No AI agents seen in this period",
    },
    {
      id: "reasons",
      label: "Failure reasons",
      column: "Reason",
      field: "reason",
      rows: t?.reason?.filter(
        (r) =>
          !r.value.startsWith("harder_") && !r.value.startsWith("allowed:"),
      ),
      name: (r) => reasonLabel(r.value),
      empty: "Nothing failed or was blocked in this period",
    },
  ],
  clients: [
    {
      id: "browsers",
      label: "Browsers",
      column: "Browser",
      field: "browser",
      rows: t?.browser,
      name: (r) => r.value,
      risk: true,
      empty: "No browser data in this period",
    },
    {
      id: "os",
      label: "Systems",
      column: "Operating system",
      field: "os",
      rows: t?.os,
      name: (r) => r.value,
      icon: osIcon,
      risk: true,
      empty: "No operating system data in this period",
    },
    {
      id: "devices",
      label: "Devices",
      column: "Device",
      field: "platform",
      rows: t?.platform,
      name: (r) => r.value,
      risk: true,
      empty: "No device data in this period",
    },
  ],
  sources: [
    {
      id: "origins",
      label: "Websites",
      column: "Origin",
      field: "origin",
      rows: t?.origin,
      name: (r) => r.value.replace(/^https?:\/\//, ""),
      risk: true,
      empty: "No origins recorded in this period",
    },
    {
      id: "languages",
      label: "Languages",
      column: "Language",
      field: "lang",
      rows: t?.lang,
      name: (r) => {
        try {
          return (
            new Intl.DisplayNames(undefined, { type: "language" }).of(
              r.value,
            ) ?? r.value
          );
        } catch {
          return r.value;
        }
      },
      risk: true,
      empty: "No language data in this period",
    },
  ],
});

const tabs = $derived(tabsFor(top));
const flat = (t) => Object.values(t).flat();

const MAP_METRICS = [
  { id: "volume", label: "Traffic" },
  { id: "blocked", label: "Block rate" },
  { id: "change", label: "Change" },
];

const mapOf = (ins) => {
  const cur = ins?.countries?.current ?? [];
  const prev = Object.fromEntries(
    (ins?.countries?.previous ?? []).map((r) => [r.value, r.n]),
  );
  const rows = Object.fromEntries(cur.map((r) => [r.value, r]));
  const values = {};
  for (const r of cur) {
    if (mapMetric === "volume") values[r.value] = r.n;
    else if (mapMetric === "blocked")
      values[r.value] = r.n >= 5 ? (r.blocked + r.flagged) / r.n : 0;
    else if (prev[r.value] || r.n >= 5)
      values[r.value] = prev[r.value]
        ? Math.max(-1, Math.min(1, (r.n - prev[r.value]) / prev[r.value]))
        : 1;
  }
  const describe = (code) => {
    const r = rows[code];
    if (!r) return prev[code] ? `none now, ${n(prev[code])} before` : "";
    if (mapMetric === "volume") return `${n(r.n)} events`;
    if (mapMetric === "blocked")
      return `${Math.round(((r.blocked + r.flagged) / r.n) * 100)}% flagged or blocked of ${n(r.n)}`;
    const p = prev[code];
    if (!p) return `${n(r.n)} events, new this period`;
    const d = Math.round(((r.n - p) / p) * 100);
    return `${n(r.n)} events, ${d >= 0 ? "up" : "down"} ${Math.abs(d)}%`;
  };
  return { values, describe, empty: !cur.length };
};
</script>

{#snippet flagIcon(r)}
  {@const src = flagUrl(r.value)}
  <span class="flex w-[18px] shrink-0 items-center justify-center" aria-hidden="true">
    {#if src}
      <img
        {src}
        alt=""
        class="h-3.5 w-[18px] rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        width="18"
        height="14"
        onerror={(e) => (e.currentTarget.style.visibility = "hidden")}
      />
    {/if}
  </span>
{/snippet}

{#snippet asnIcon(r)}
  <span class="flex size-4 shrink-0 items-center justify-center"><AsnIcon asn={r.label} /></span>
{/snippet}

{#snippet osIcon(r)}
  <span class="flex w-4 shrink-0 justify-center"><OsIcon name={r.value} /></span>
{/snippet}

{#snippet agentIcon(r)}
  <AgentIcon id={r.value} />
{/snippet}

{#snippet geoOff()}
  <div class="m-auto flex max-w-64 flex-col items-center gap-3 text-center">
    <p class="text-sm text-balance text-muted-foreground">Turn on visitor location to see countries and networks.</p>
    <Button size="sm" onclick={() => navigate({ view: "settings", section: "ipdata" })}>Set up visitor location</Button>
  </div>
{/snippet}

{#snippet mapTabs()}
  <SlidingTabs
    tabs={MAP_METRICS}
    bind:value={mapMetric}
    flat
    pillClass="rounded-md bg-background"
    activeTabClass="text-foreground"
    tabClass="rounded-md px-2.5 py-1 text-sm"
  />
{/snippet}

{#snippet heatTabs()}
  <SlidingTabs
    tabs={[{ id: "all", label: "All traffic" }, { id: "bad", label: "Flagged and blocked" }]}
    bind:value={heatMode}
    flat
    pillClass="rounded-md bg-background"
    activeTabClass="text-foreground"
    tabClass="rounded-md px-2.5 py-1 text-sm"
  />
{/snippet}

{#snippet moversAside()}
  <span class="pe-2 text-sm text-muted-foreground">Compared with the previous {rangeInfo.label.replace("Past ", "")}</span>
{/snippet}

{#snippet moversSkeleton()}
  <span class="grid gap-x-6 gap-y-0.5 lg:grid-cols-2">
    {#each Array(6) as _, k (k)}
      <span class="flex h-10 items-center gap-3 px-2">
        <span class="flex flex-1 flex-col gap-1.5"><Bone height="0.625rem" width="{40 + ((k * 23) % 35)}%" radius="4px" /><Bone height="0.5rem" width="4rem" radius="4px" /></span>
        <Bone height="0.625rem" width="3rem" radius="4px" />
      </span>
    {/each}
  </span>
{/snippet}

{#snippet metricSkeleton()}
  <span class="flex flex-col items-start gap-0.5">
    <span class="flex h-8 items-center"><Bone height="1.375rem" width="3rem" radius="6px" /></span>
    <span class="flex h-4 items-center"><Bone height="0.625rem" width="5rem" radius="4px" /></span>
  </span>
{/snippet}

{#snippet visitorsSkeleton()}
  <span class="flex h-5 items-center"><Bone height="0.625rem" width="12rem" radius="4px" /></span>
{/snippet}

{#snippet change(m, cur, prev, format)}
  {@const d = delta(cur, prev)}
  {#if d}
    <span class="grid text-xs tabular-nums">
    <span
      class="col-start-1 row-start-1 inline-flex items-center gap-0.5 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-(--ease-out) [@media(hover:hover)]:group-hover/tile:-translate-y-1 [@media(hover:hover)]:group-hover/tile:opacity-0 {d.flat
        ? 'text-muted-foreground'
        : m.bad
          ? d.up
            ? 'text-destructive'
            : 'text-success'
          : m.id === 'avg'
            ? d.up
              ? 'text-warning'
              : 'text-success'
            : 'text-muted-foreground'}"
    >
      {#if !d.flat}
        <Icon name={d.up ? "trendUp" : "trendDown"} size={12} stroke={2.25} />
        <span class="sr-only">{d.up ? "Up" : "Down"}</span>
      {/if}
      {d.text}
      <span class="sr-only">from {format(prev)} in the previous period</span>
    </span>
    <span aria-hidden="true" class="col-start-1 row-start-1 translate-y-1 text-muted-foreground opacity-0 motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-(--ease-out) [@media(hover:hover)]:group-hover/tile:translate-y-0 [@media(hover:hover)]:group-hover/tile:opacity-100">from {format(prev)}</span>
    </span>
  {:else}
    <span class="text-xs text-muted-foreground">No earlier data</span>
  {/if}
{/snippet}

<svelte:window onkeydown={onKeydown} />

<PageHeader title="Overview">
  {#snippet actions()}
    {#if live != null}
      <button
        type="button"
        class="flex h-8 cursor-pointer items-center gap-2 rounded-[calc(var(--radius)-4px)] px-2 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
        title="Show events from the last hour"
        onclick={() => openEvents(["range:1h"])}
      >
        <span class="size-2 rounded-full {live > 0 ? 'bg-success' : 'bg-faint-foreground'}" aria-hidden="true"></span>
        <span><Odometer class="font-medium text-foreground" value={live} format={n} /><span class="ms-1 max-sm:sr-only">in the last hour</span></span>
      </button>
    {/if}
    <RangePicker class="rounded-[calc(var(--radius)-4px)]" value={range} ranges={RANGES} onchange={setRange} />
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-4 px-4 pt-5 pb-12 md:px-5">
  {#await onboarding then { default: Onboarding }}<Onboarding />{/await}
  {#if data?.storage === "redis" || data?.storage === "off"}
    <p class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm text-pretty text-muted-foreground">
      {data.storage === "off"
        ? "Analytics are off, so Cap isn't recording anything for this page."
        : "Cap is only counting totals, so locations, networks, risk flags and insights stay empty."}
      <Button size="sm" onclick={() => navigate({ view: "settings", section: "analytics" })}>Open storage settings</Button>
    </p>
  {/if}
  <div>
  <Card variant="layered" role="region" aria-label="Traffic">
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label="Chart metric"
      bind:value={() => metric, (v) => v && (metric = v)}
      bind:ref={metricGroup}
      class="relative grid w-full grid-cols-2 items-stretch pb-1 sm:grid-cols-3 lg:grid-cols-6"
    >
      {#if pill}
        <span
          aria-hidden="true"
          class="pointer-events-none absolute top-0 left-0 rounded-lg bg-background {pill.ready ? 'transition-[translate,width,height] duration-300 ease-(--ease-out) motion-reduce:transition-none' : ''}"
          style:translate="{pill.x}px {pill.y}px"
          style:width="{pill.w}px"
          style:height="{pill.h}px"
        ></span>
      {/if}
      {#each METRICS as m, k (m.id)}
        {@const on = metric === m.id}
        <ToggleGroupItem
          value={m.id}
          aria-keyshortcuts={String(k + 1)}
          class="group/tile relative h-auto min-w-0 cursor-pointer flex-col items-start justify-start gap-0.5 rounded-lg px-3 py-2.5 text-left sm:px-4 sm:py-3 font-normal whitespace-normal transition-none! [&_svg:not([class*='size-'])]:size-3 [@media(hover:hover)]:hover:bg-background/50 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent"
        >
          <span class="flex items-center gap-1.5 text-sm {on ? 'text-foreground' : 'text-muted-foreground'}">
            <span class="size-2 rounded-full" style:background={m.color}></span>
            {m.label}
          </span>
          <Skeleton data={summary} skeleton={metricSkeleton}>
            {#snippet children(s)}
              <span class="flex flex-col items-start gap-0.5">
                <Odometer class="text-2xl font-semibold" value={s[m.id]} format={compact} />
                {@render change(m, s[m.id], previous?.[m.id], compact)}
              </span>
            {/snippet}
          </Skeleton>
        </ToggleGroupItem>
      {/each}
      <div class="flex min-w-0 flex-col items-start gap-0.5 px-3 py-2.5 sm:px-4 sm:py-3">
        <span class="text-sm text-muted-foreground">Avg. solve time</span>
        <Skeleton data={summary} skeleton={metricSkeleton}>
          {#snippet children(s)}
            <span class="flex flex-col items-start gap-0.5">
              <Odometer class="text-2xl font-semibold" value={s.avg_solve} format={latency} />
              {@render change({ id: "avg" }, s.avg_solve, previous?.avg_solve, latency)}
            </span>
          {/snippet}
        </Skeleton>
      </div>
    </ToggleGroup>

    <CardContent class="gap-2 pt-5 pb-3 transition-opacity duration-200 {loading && data ? 'opacity-60' : ''}">
      <Skeleton {data} sample={samples.overview} label="Loading chart">
        {#snippet children(d)}
          {#if !d.series?.length || !d.summary?.total}
            <p class="flex h-[15rem] items-center justify-center text-sm text-muted-foreground">No traffic in {rangeInfo.long}</p>
          {:else}
            <TrafficChart series={d.series} bucket={d.range.bucket} {metric} metrics={METRICS} previous={compare ? d.previousSeries : null} onpick={(from, to) => openEvents([...METRICS.find((m) => m.id === metric).filters, `window:${from}-${to}`])} />
          {/if}
        {/snippet}
      </Skeleton>
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Skeleton data={summary} skeleton={visitorsSkeleton}>
          {#snippet children(s)}
            <p class="text-sm text-pretty text-muted-foreground">
              <Odometer class="font-medium text-foreground" value={s.clients} format={n} /> visitors{#if s.agents}, <Odometer class="font-medium text-foreground" value={s.agents} format={n} /> of them AI agents{/if}
            </p>
          {/snippet}
        </Skeleton>
        <div class="flex items-center gap-1 max-sm:-ms-2 sm:-me-2">
          {#if data?.previousSeries?.length}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={compare}
              class={compare ? "bg-nav-hover text-foreground" : "text-muted-foreground"}
              onclick={toggleCompare}
            >
              <span class="h-0.5 w-3 rounded-full bg-current" aria-hidden="true"></span>
              Compare with previous
            </Button>
          {/if}
          <Button
            variant="ghost"
            size="sm"
            onclick={() => drill(METRICS.find((m) => m.id === metric).filters)}
          >
            {METRICS.find((m) => m.id === metric).view}
            <Icon name="right" size={13} />
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
  </div>

  <div class="grid">
    <Panel title="Biggest changes" aside={moversAside} stale={(loading || pairing) && !!pair}>
      {#if summary && !previous?.total}
        <p class="m-auto py-8 text-sm text-muted-foreground">No earlier period to compare yet.</p>
      {:else}
        <Skeleton class="skeleton-fill" data={pair} skeleton={moversSkeleton} label="Loading changes">
          {#snippet children(p)}{#await moversView then { default: Movers }}<Movers now={p.now} before={p.before} totals={p.totals} onpick={drill} />{/await}{/snippet}
        </Skeleton>
      {/if}
    </Panel>
  </div>
  <div class="grid gap-4 lg:grid-cols-2">
    <Panel title="Risk scores" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading chart">
        {#snippet children(i)}{#await panels then { ScoreChart }}<ScoreChart rows={i.scores} />{/await}{/snippet}
      </Skeleton>
    </Panel>
    <Panel title="Solve times" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading chart">
        {#snippet children(i)}{#await panels then { SolveChart }}<SolveChart solve={i.solve} />{/await}{/snippet}
      </Skeleton>
    </Panel>
  </div>
  <div class="grid gap-4 lg:grid-cols-2">
    <Panel title="Where challenges end up" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading chart">
        {#snippet children(i)}{#await panels then { Flow }}<Flow onpick={drill} flow={i.flow} previous={i.previousFlow} />{/await}{/snippet}
      </Skeleton>
    </Panel>
    <Panel title="When traffic arrives" aside={heatTabs} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading chart">
        {#snippet children(i)}{#await panels then { WeekHeatmap }}<WeekHeatmap hours={i.hours} mode={heatMode} onpick={openEvents} />{/await}{/snippet}
      </Skeleton>
    </Panel>
  </div>
  <div class="grid">
    <Panel title="Where traffic comes from" aside={mapTabs} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading map">
        {#snippet children(i)}
          {@const map = mapOf(i)}
          {#if map.empty}
            {#if !geo}{@render geoOff()}{:else}<p class="m-auto py-10 text-sm text-muted-foreground">No location data in this period</p>{/if}
          {:else}
            {#await worldMap then { default: WorldMap }}
            <WorldMap
              values={map.values}
              color={mapMetric === "blocked" ? "var(--destructive)" : "var(--chart-3)"}
              diverging={mapMetric === "change"}
              describe={map.describe}
              countries={i.countries}
              highlight={peek}
              onpick={(code) => drill([`country:${code}`])}
            />
            {/await}
            <p class="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              {#if mapMetric === "change"}
                <span class="me-1 inline-block size-2 rounded-full bg-info"></span>More than the previous period
                <span class="ms-3 me-1 inline-block size-2 rounded-full bg-warning"></span>Less
              {:else if mapMetric === "blocked"}
                Share of each country's events that were flagged or blocked, for countries with 5 or more.
              {:else}
                Pick a country to see its events.
              {/if}
            </p>
          {/if}
        {/snippet}
      </Skeleton>
    </Panel>
  </div>
  <div class="grid gap-4 lg:grid-cols-2">
    <Breakdown tabs={tabs.threats} stale={loading && !!top} onpick={drill} />
    <Breakdown tabs={tabs.locations} stale={loading && !!top} onpick={drill} onpeek={(field, v) => (peek = field === "country" ? v : null)} />
  </div>
  <div class="grid gap-4 lg:grid-cols-2">
    <Breakdown tabs={tabs.clients} stale={loading && !!top} onpick={drill} />
    <Breakdown tabs={tabs.sources} stale={loading && !!top} onpick={drill} />
  </div>
  <div class="grid">
    <Panel title="Browsers behind many addresses" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label="Loading browsers">
        {#snippet children(i)}{#await sharedView then { default: SharedClients }}<SharedClients rows={i.shared} onpick={drill} />{/await}{/snippet}
      </Skeleton>
    </Panel>
  </div>
</div>

