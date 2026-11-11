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
import { countryName, flagUrl, languageName } from "../../lib/geo.js";
import { locale, numFmt, t } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import {
  app,
  hasGeoSource,
  navigate,
  openEvents,
} from "../../lib/state.svelte.js";
import AsnIcon from "./AsnIcon.svelte";
import Breakdown from "./Breakdown.svelte";
import Flow from "./Flow.svelte";
import OsIcon from "./OsIcon.svelte";
import Panel from "./Panel.svelte";
import ScoreChart from "./ScoreChart.svelte";
import SharedClients from "./SharedClients.svelte";
import SolveChart from "./SolveChart.svelte";
import TrafficChart from "./TrafficChart.svelte";
import WeekHeatmap from "./WeekHeatmap.svelte";
import WorldMap from "./WorldMap.svelte";

const RANGE_IDS = ["24h", "7d", "30d", "90d"];
const RANGES = $derived([
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

const METRICS = $derived([
  {
    id: "challenges",
    label: t("Challenges"),
    color: "var(--chart-1)",
    chart: true,
    filters: ["type:challenge"],
  },
  {
    id: "solved",
    label: t("Passed"),
    color: "var(--success)",
    chart: true,
    filters: ["type:redeem", "outcome:pass"],
  },
  {
    id: "flagged",
    label: t("Flagged"),
    color: "var(--warning)",
    chart: true,
    bad: true,
    filters: ["type:redeem", "outcome:pass"],
  },
  {
    id: "blocked",
    label: t("Blocked"),
    color: "var(--destructive)",
    chart: true,
    bad: true,
    filters: ["outcome:block"],
  },
  {
    id: "failed",
    label: t("Failed"),
    color: "var(--faint-foreground)",
    chart: true,
    bad: true,
    filters: ["outcome:fail"],
  },
]);

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

let range = $state(RANGE_IDS.includes(stored) ? stored : "7d");
let metric = $state("challenges");
let metricGroup = $state(null);
let pill = $state(null);

$effect(() => {
  metric;
  locale.value;
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
let insights = $state(null);
let mapMetric = $state("volume");
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
  if (!prev) return { up: true, text: t("New") };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { up: pct > 0, flat: pct === 0, text: `${Math.abs(pct)}%` };
};

const n = (v) => numFmt(v ?? 0);

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
  if (!overview?.error) data = overview;
  if (!dims?.error) top = dims;
  if (!extra?.error) insights = extra;
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
    if (!res?.error) live = res.summary?.challenges ?? 0;
  } finally {
    pulsing = false;
  }
}

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

const named = (fn) => (r) => fn(r.value) || r.value;

const tabsFor = (topData) => ({
  locations: [
    {
      id: "countries",
      label: t("Countries"),
      column: t("Country"),
      field: "country",
      rows: topData?.country,
      name: named(countryName),
      icon: flagIcon,
      image: (r) => flagUrl(r.value),
      risk: true,
      empty: t("No location data in this period"),
      body: !geo && topData?.country?.length === 0 ? geoOff : undefined,
    },
    {
      id: "networks",
      label: t("Networks"),
      column: t("Network"),
      field: "asn_org",
      rows: topData?.asn_org,
      name: (r) => r.value,
      icon: asnIcon,
      risk: true,
      empty: t("No network data in this period"),
      body: !geo && topData?.asn_org?.length === 0 ? geoOff : undefined,
    },
  ],
  threats: [
    {
      id: "flags",
      label: t("Risk flags"),
      column: t("Signal"),
      field: "flag",
      rows: topData?.flag?.filter((r) => !r.value.startsWith("rule:")),
      name: (r) => signalInfo(r.value).text,
      risk: true,
      empty: t(
        "No risk flags in this period. Requests that trip a detection check show up here.",
      ),
    },
    {
      id: "agents",
      label: t("AI agents"),
      column: t("Agent"),
      field: "agent",
      rows: topData?.agent,
      name: (r) => agentName(r.value),
      icon: agentIcon,
      risk: true,
      empty: t("No AI agents seen in this period"),
    },
    {
      id: "reasons",
      label: t("Failure reasons"),
      column: t("Reason"),
      field: "reason",
      rows: topData?.reason?.filter(
        (r) =>
          !r.value.startsWith("harder_") && !r.value.startsWith("allowed:"),
      ),
      name: (r) => reasonLabel(r.value),
      empty: t("Nothing failed or was blocked in this period"),
    },
  ],
  clients: [
    {
      id: "browsers",
      label: t("Browsers"),
      column: t("Browser"),
      field: "browser",
      rows: topData?.browser,
      name: (r) => r.value,
      risk: true,
      empty: t("No browser data in this period"),
    },
    {
      id: "os",
      label: t("Systems"),
      column: t("Operating system"),
      field: "os",
      rows: topData?.os,
      name: (r) => r.value,
      icon: osIcon,
      risk: true,
      empty: t("No operating system data in this period"),
    },
    {
      id: "devices",
      label: t("Devices"),
      column: t("Device"),
      field: "platform",
      rows: topData?.platform,
      name: (r) => t(r.value),
      risk: true,
      empty: t("No device data in this period"),
    },
  ],
  sources: [
    {
      id: "origins",
      label: t("Websites"),
      column: t("Origin"),
      field: "origin",
      rows: topData?.origin,
      name: (r) => r.value.replace(/^https?:\/\//, ""),
      risk: true,
      empty: t("No origins recorded in this period"),
    },
    {
      id: "languages",
      label: t("Languages"),
      column: t("Language"),
      field: "lang",
      rows: topData?.lang,
      name: (r) => languageName(r.value),
      risk: true,
      empty: t("No language data in this period"),
    },
  ],
});

const tabs = $derived(tabsFor(top));

const MAP_METRICS = $derived([
  { id: "volume", label: t("Traffic") },
  { id: "blocked", label: t("Block rate") },
  { id: "change", label: t("Change") },
]);

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
    if (!r)
      return prev[code]
        ? t("none now, {count} before", { count: n(prev[code]) })
        : "";
    if (mapMetric === "volume") return t("{count} events", { count: n(r.n) });
    if (mapMetric === "blocked")
      return t("{pct}% flagged or blocked of {count}", {
        pct: Math.round(((r.blocked + r.flagged) / r.n) * 100),
        count: n(r.n),
      });
    const p = prev[code];
    if (!p) return t("{count} events, new this period", { count: n(r.n) });
    const d = Math.round(((r.n - p) / p) * 100);
    return d >= 0
      ? t("{count} events, up {pct}%", { count: n(r.n), pct: Math.abs(d) })
      : t("{count} events, down {pct}%", { count: n(r.n), pct: Math.abs(d) });
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
    <p class="text-sm text-balance text-muted-foreground">{t("Visitor location is off. Turn it on to see which countries and networks traffic comes from.")}</p>
    <Button size="sm" onclick={() => navigate({ view: "settings", section: "ipdata" })}>{t("Set up visitor location")}</Button>
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
    tabs={[{ id: "all", label: t("All traffic") }, { id: "bad", label: t("Flagged and blocked") }]}
    bind:value={heatMode}
    flat
    pillClass="rounded-md bg-background"
    activeTabClass="text-foreground"
    tabClass="rounded-md px-2.5 py-1 text-sm"
  />
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

{#snippet change(m, cur, prev)}
  {@const d = delta(cur, prev)}
  {#if d}
    <span
      class="inline-flex items-center gap-0.5 text-xs tabular-nums {d.flat
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
        <span class="sr-only">{d.up ? t("Up") : t("Down")}</span>
      {/if}
      {d.text}
    </span>
  {:else}
    <span class="text-xs text-muted-foreground">{t("No earlier data")}</span>
  {/if}
{/snippet}

<PageHeader title={t("Overview")}>
  {#snippet actions()}
    {#if live != null}
      <span class="flex h-8 items-center gap-2 px-1 text-sm text-muted-foreground">
        <span class="relative flex size-2" aria-hidden="true">
          {#if live > 0}
            <span class="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping"></span>
          {/if}
          <span class="relative size-2 rounded-full {live > 0 ? 'bg-success' : 'bg-faint-foreground'}"></span>
        </span>
        <span><Odometer class="font-medium text-foreground" value={live} format={n} /><span class="ms-1 max-sm:sr-only">{t("in the last hour")}</span></span>
      </span>
    {/if}
    <RangePicker class="rounded-[calc(var(--radius)-4px)]" value={range} ranges={RANGES} onchange={setRange} />
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-4 px-4 pt-5 pb-12 md:px-5">
  <Card variant="layered" role="region" aria-label={t("Traffic")}>
    <ToggleGroup
      type="single"
      spacing={1}
      aria-label={t("Chart metric")}
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
      {#each METRICS as m (m.id)}
        {@const on = metric === m.id}
        <ToggleGroupItem
          value={m.id}
          class="relative h-auto min-w-0 cursor-pointer flex-col items-start justify-start gap-0.5 rounded-lg px-4 py-3 text-left font-normal whitespace-normal transition-none! [&_svg:not([class*='size-'])]:size-3 hover:bg-background/50 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent"
        >
          <span class="flex items-center gap-1.5 text-sm {on ? 'text-foreground' : 'text-muted-foreground'}">
            <span class="size-2 rounded-full" style:background={m.color}></span>
            {m.label}
          </span>
          <Skeleton data={summary} skeleton={metricSkeleton}>
            {#snippet children(s)}
              <span class="flex flex-col items-start gap-0.5">
                <span class="text-2xl font-semibold tabular-nums">{compact(s[m.id])}</span>
                {@render change(m, s[m.id], previous?.[m.id])}
              </span>
            {/snippet}
          </Skeleton>
        </ToggleGroupItem>
      {/each}
      <div class="flex min-w-0 flex-col items-start gap-0.5 px-4 py-3">
        <span class="text-sm text-muted-foreground">{t("Avg. solve time")}</span>
        <Skeleton data={summary} skeleton={metricSkeleton}>
          {#snippet children(s)}
            <span class="flex flex-col items-start gap-0.5">
              <span class="text-2xl font-semibold tabular-nums">{latency(s.avg_solve)}</span>
              {@render change({ id: "avg" }, s.avg_solve, previous?.avg_solve)}
            </span>
          {/snippet}
        </Skeleton>
      </div>
    </ToggleGroup>

    <CardContent class="gap-2 pt-5 pb-3 transition-opacity duration-200 {loading && data ? 'opacity-60' : ''}">
      <Skeleton {data} sample={samples.overview} label={t("Loading chart")}>
        {#snippet children(d)}
          {#if !d.series?.length || !d.summary?.total}
            <p class="flex h-[15rem] items-center justify-center text-sm text-muted-foreground">{t("No traffic in {range}", { range: rangeInfo.long })}</p>
          {:else}
            <TrafficChart series={d.series} bucket={d.range.bucket} {metric} metrics={METRICS} />
          {/if}
        {/snippet}
      </Skeleton>
      <div class="flex items-center justify-between gap-4">
        <Skeleton data={summary} skeleton={visitorsSkeleton}>
          {#snippet children(s)}
            <p class="text-sm text-pretty text-muted-foreground">
              <span class="font-medium text-foreground tabular-nums">{n(s.clients)}</span> {t("visitors")}{#if s.agents}{t(", ")}<span class="font-medium text-foreground tabular-nums">{n(s.agents)}</span> {t("of them AI agents")}{/if}
            </p>
          {/snippet}
        </Skeleton>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => openEvents(METRICS.find((m) => m.id === metric).filters)}
        >
          {t("View these events")}
          <Icon name="right" size={13} />
        </Button>
      </div>
    </CardContent>
  </Card>

  <div class="grid gap-4 lg:grid-cols-2">
    <Panel title={t("Risk scores")} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading chart")}>
        {#snippet children(i)}<ScoreChart rows={i.scores} />{/snippet}
      </Skeleton>
    </Panel>
    <Panel title={t("Solve times")} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading chart")}>
        {#snippet children(i)}<SolveChart solve={i.solve} />{/snippet}
      </Skeleton>
    </Panel>
    <Panel title={t("Where challenges end up")} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading chart")}>
        {#snippet children(i)}<Flow flow={i.flow} />{/snippet}
      </Skeleton>
    </Panel>
    <Panel title={t("When traffic arrives")} aside={heatTabs} stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading chart")}>
        {#snippet children(i)}<WeekHeatmap hours={i.hours} mode={heatMode} />{/snippet}
      </Skeleton>
    </Panel>
    <Panel title={t("Where traffic comes from")} aside={mapTabs} class="lg:col-span-2" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading map")}>
        {#snippet children(i)}
          {@const map = mapOf(i)}
          {#if map.empty}
            {#if !geo}{@render geoOff()}{:else}<p class="m-auto py-10 text-sm text-muted-foreground">{t("No location data in this period")}</p>{/if}
          {:else}
            <WorldMap
              values={map.values}
              color={mapMetric === "blocked" ? "var(--destructive)" : "var(--chart-3)"}
              diverging={mapMetric === "change"}
              describe={map.describe}
              onpick={(code) => openEvents([`country:${code}`])}
            />
            <p class="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
              {#if mapMetric === "change"}
                <span class="me-1 inline-block size-2 rounded-full bg-info"></span>{t("More than the previous period")}
                <span class="ms-3 me-1 inline-block size-2 rounded-full bg-warning"></span>{t("Less")}
              {:else if mapMetric === "blocked"}
                {t("Share of each country's events that were flagged or blocked, for countries with 5 or more.")}
              {:else}
                {t("Pick a country to see its events.")}
              {/if}
            </p>
          {/if}
        {/snippet}
      </Skeleton>
    </Panel>
    <Breakdown tabs={tabs.threats} stale={loading && !!top} onpick={openEvents} />
    <Breakdown tabs={tabs.locations} stale={loading && !!top} onpick={openEvents} />
    <Breakdown tabs={tabs.clients} stale={loading && !!top} onpick={openEvents} />
    <Breakdown tabs={tabs.sources} stale={loading && !!top} onpick={openEvents} />
    <Panel title={t("Browsers behind many addresses")} class="lg:col-span-2" stale={loading && !!insights}>
      <Skeleton class="skeleton-fill" data={insights} sample={samples.insights} label={t("Loading browsers")}>
        {#snippet children(i)}<SharedClients rows={i.shared} />{/snippet}
      </Skeleton>
    </Panel>
  </div>
</div>
