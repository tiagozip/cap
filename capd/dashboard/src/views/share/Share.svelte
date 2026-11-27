<script>
import { onMount } from "svelte";
import Button from "../../components/cap/Button.svelte";
import Empty from "../../components/cap/Empty.svelte";
import NotchFilter from "../../components/cap/NotchFilter.svelte";
import Odometer from "../../components/cap/Odometer.svelte";
import RangePicker from "../../components/cap/RangePicker.svelte";
import Skeleton from "../../components/cap/Skeleton.svelte";
import Icon from "../../components/Icon.svelte";
import Card from "../../components/ui/card/Card.svelte";
import CardContent from "../../components/ui/card/CardContent.svelte";
import { url } from "../../lib/api.js";
import { compact, latency, trend } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import OsIcon from "../activity/OsIcon.svelte";
import TrafficChart from "../activity/TrafficChart.svelte";
import ShareBreakdown from "./ShareBreakdown.svelte";

const RANGES = [
  { id: "today", short: "1d", label: "Today", long: "today" },
  { id: "yesterday", short: "", label: "Yesterday", long: "yesterday" },
  {
    id: "last7days",
    short: "7d",
    label: "Past 7 days",
    long: "the last 7 days",
  },
  {
    id: "last28days",
    short: "28d",
    label: "Past 28 days",
    long: "the last 28 days",
  },
  {
    id: "last91days",
    short: "91d",
    label: "Past 3 months",
    long: "the last 3 months",
  },
  { id: "alltime", short: "", label: "All time", long: "this period" },
];

const METRICS = [
  {
    id: "challenges",
    label: "Challenges",
    color: "var(--chart-1)",
    chart: true,
  },
  { id: "solved", label: "Passed", color: "var(--success)", chart: true },
  {
    id: "failed",
    label: "Failed",
    color: "var(--faint-foreground)",
    chart: true,
  },
];

const token = location.hash.slice(1);
const LIVE_MS = 60_000;

const initialRange = new URLSearchParams(location.search).get("range");
let range = $state(
  RANGES.some((r) => r.id === initialRange) ? initialRange : "last7days",
);
let updated = $state(0);
let now = $state(Date.now());
let share = $state(null);
let geo = $state(null);
let error = $state(token ? "" : "This link is missing its share token.");
let notice = $state("");
let retryable = $state(false);
let loading = $state(false);
let seq = 0;
let geoSeq = 0;
let geoLoading = $state(false);
let hot = $state(null);
let metric = $state("challenges");
let compare = $state(false);

const rangeInfo = $derived(RANGES.find((r) => r.id === range));

const dayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const utcDayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const utcShortFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const stats = $derived.by(() => {
  const s = share?.stats;
  if (!s) return null;
  const ps = share.prevStats;
  const failed = (x) => Math.max(0, (x.challenges || 0) - (x.verified || 0));
  return {
    challenges: [s.challenges || 0, ps?.challenges],
    solved: [s.verified || 0, ps?.verified],
    failed: [failed(s), ps ? failed(ps) : null],
    avg: [s.avgLatency || 0, ps?.avgLatency],
  };
});

const series = $derived(
  (share?.chartData?.data ?? []).map((d) => ({
    b: d.bucket * 1000,
    challenges: d.challenges || 0,
    solved: d.verified || 0,
    failed: d.failed || 0,
  })),
);
const previousSeries = $derived(
  share?.prevChartData?.data?.length
    ? share.prevChartData.data.map((d) => ({
        b: d.bucket * 1000,
        solved: d.verified || 0,
        failed: d.failed || 0,
      }))
    : null,
);

const sampleChart = {
  series: samples.overview.series,
  bucket: samples.overview.range.bucket,
  total: 1,
};
const bucket = $derived((share?.chartData?.bucketSize ?? 3600) * 1000);

const span = $derived.by(() => {
  if (!series.length) return "";
  const from = new Date(series[0].b);
  const to = new Date(series.at(-1).b);
  const last = utcDayFmt.format(to);
  const day = (d) => d.toISOString().slice(0, 10);
  if (day(from) === day(to)) return `${last}, UTC`;
  const first =
    from.getUTCFullYear() === to.getUTCFullYear()
      ? utcShortFmt.format(from)
      : utcDayFmt.format(from);
  return `${first} to ${last}, UTC`;
});

const relDays = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

const expires = $derived.by(() => {
  if (!share?.expires) return null;
  const day = (t) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((day(share.expires) - day(now)) / 86_400_000);
  if (days > 7)
    return { text: dayFmt.format(new Date(share.expires)), soon: false };
  return { text: relDays.format(Math.max(0, days), "day"), soon: days <= 2 };
});

const MIX = [
  "var(--chart-3)",
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-2)",
];

const rate = (n, of) => {
  if (!of) return 0;
  const v = (n / of) * 100;
  return v > 99 && v < 100 ? 99 : v > 0 && v < 1 ? 1 : Math.round(v);
};

const geoNote = $derived(geo?.range ? undefined : "All time");
const geoStale = $derived(geoLoading && !!geo?.range);

const rows = (items, value, name) =>
  geo
    ? (items ?? []).map((item) => ({
        value: value(item),
        name: name(item),
        n: item.count,
      }))
    : null;

const geoTabs = $derived.by(() => ({
  countries: [
    {
      id: "countries",
      label: "Countries",
      column: "Country",
      rows: rows(
        geo?.countries,
        (c) => c.code,
        (c) => countryName(c.code),
      ),
      total: geo?.totalCountry,
      icon: flagIcon,
      image: (r) => flagUrl(r.value),
      empty: geo?.range
        ? `No locations in ${rangeInfo.long}`
        : "No location data yet",
    },
  ],
  networks: [
    {
      id: "networks",
      label: "Networks",
      column: "Network",
      rows: rows(
        geo?.asns,
        (a) => a.name,
        (a) => a.name,
      ),
      total: geo?.totalAsn,
      empty: geo?.range
        ? `No networks in ${rangeInfo.long}`
        : "No network data yet",
    },
  ],
  devices: rows(
    geo?.platforms,
    (p) => p.name,
    (p) => p.name,
  ),
  clients: [
    {
      id: "devices",
      label: "Devices",
      column: "Device",
      rows: rows(
        geo?.platforms,
        (p) => p.name,
        (p) => p.name,
      ),
      total: geo?.totalPlatform,
      empty: geo?.range
        ? `No devices in ${rangeInfo.long}`
        : "No device data yet",
    },
    {
      id: "os",
      label: "Systems",
      column: "Operating system",
      rows: rows(
        geo?.oses,
        (o) => o.name,
        (o) => o.name,
      ),
      total: geo?.totalOs,
      icon: osIcon,
      empty: geo?.range
        ? `No operating systems in ${rangeInfo.long}`
        : "No operating system data yet",
    },
  ],
}));

const get = async (path) => {
  try {
    const res = await fetch(url(path));
    if (res.status === 429)
      return {
        shown: true,
        error:
          "You've refreshed too often. Wait a few seconds, then try again.",
      };
    return await res.json();
  } catch {
    return {
      shown: true,
      error: "Couldn't reach the server. Check your connection and try again.",
    };
  }
};

async function loadGeo() {
  const id = ++geoSeq;
  geoLoading = true;
  const data = await get(
    `share/${encodeURIComponent(token)}/geo-stats?chartDuration=${range}`,
  );
  if (id !== geoSeq) return;
  geoLoading = false;
  if (data?.error) {
    geo ??= {};
    return;
  }
  geo = data;
}

const ago = $derived.by(() => {
  if (!updated) return "";
  const s = Math.round((now - updated) / 1000);
  if (s < 45) return "Updated just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Updated ${m} min ago`;
  return `Updated ${Math.round(m / 60)} h ago`;
});

async function load(withGeo = false, quiet = false) {
  const id = ++seq;
  loading = !quiet;
  if (withGeo) loadGeo();
  const data = await get(
    `share/${encodeURIComponent(token)}?chartDuration=${range}`,
  );
  if (id !== seq) return;
  loading = false;
  if (data?.shown && share) {
    if (!quiet) notice = data.error;
    return;
  }
  if (!data?.stats) {
    retryable = !!data?.shown;
    error = data?.shown
      ? data.error
      : "This share link is invalid or has expired.";
    document.title = "Stats unavailable";
    return;
  }
  error = "";
  notice = "";
  share = data;
  updated = Date.now();
  now = updated;
  document.title = `${data.name} · Cap stats`;
}

const download = () => {
  const lines = [
    "time_utc,challenges,passed,failed",
    ...series.map(
      (d) =>
        `${new Date(d.b).toISOString()},${d.challenges},${d.solved},${d.failed}`,
    ),
  ];
  const slug =
    share.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cap-stats";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([`${lines.join("\n")}\n`], { type: "text/csv" }),
  );
  a.download = `${slug}-${range}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const setRange = (id) => {
  if (id === range) return;
  range = id;
  const params = new URLSearchParams(location.search);
  if (id === "last7days") params.delete("range");
  else params.set("range", id);
  const search = params.toString();
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
  );
  load(!!geo?.range);
};

onMount(() => {
  const reload = () => location.reload();
  window.addEventListener("hashchange", reload);
  if (token) load(true);
  const root = document.documentElement;
  let wasDark = false;
  const beforePrint = () => {
    if (!root.classList.contains("dark")) return;
    wasDark = true;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  };
  const afterPrint = () => {
    if (!wasDark) return;
    wasDark = false;
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  };
  const keys = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (
      e.target.closest?.(
        "input, textarea, select, [contenteditable], [role=dialog], [role=menu]",
      )
    )
      return;
    const m = METRICS[Number(e.key) - 1];
    if (!m || !share) return;
    metric = m.id;
    if (document.activeElement?.classList.contains("tile"))
      document.querySelector(`.tile[data-metric="${m.id}"]`)?.focus();
  };
  window.addEventListener("keydown", keys);
  const tint = document.querySelector('meta[name="theme-color"]');
  const syncTint = () => {
    if (tint)
      tint.content = root.classList.contains("dark") ? "#1b1b1e" : "#fcfcfd";
  };
  const tintWatch = new MutationObserver(syncTint);
  tintWatch.observe(root, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("beforeprint", beforePrint);
  window.addEventListener("afterprint", afterPrint);
  const live = () => {
    now = Date.now();
    if (document.hidden || !share || loading || range === "yesterday") return;
    if (now - updated >= LIVE_MS) load(true, true);
  };
  const timer = setInterval(live, 15_000);
  document.addEventListener("visibilitychange", live);
  return () => {
    window.removeEventListener("hashchange", reload);
    window.removeEventListener("keydown", keys);
    tintWatch.disconnect();
    window.removeEventListener("beforeprint", beforePrint);
    window.removeEventListener("afterprint", afterPrint);
    document.removeEventListener("visibilitychange", live);
    clearInterval(timer);
  };
});
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

{#snippet worldMap(list)}
  {#if !list || list.length}
    <div class="map min-w-0 print:hidden" aria-busy={!list}>
      {#await import("../activity/WorldMap.svelte") then { default: WorldMap }}
        <WorldMap
          highlight={hot}
          values={Object.fromEntries((list ?? []).map((r) => [r.value, r.n]))}
          describe={(code) => {
            const r = list?.find((x) => x.value === code);
            return r ? `${compact(r.n)} events` : "No events";
          }}
        />
      {/await}
    </div>
  {/if}
{/snippet}

{#snippet deviceMix()}
  {@const list = geoTabs.devices}
  {@const sum = list?.reduce((a, r) => a + r.n, 0) ?? 0}
  {#if !list || sum}
    <figure class="flex flex-col gap-3 px-2 pt-1 pb-2" aria-busy={!list}>
      <figcaption class="sr-only">Devices</figcaption>
      <div class="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {#each list ?? [] as r, i (r.value)}
          <span
            class="mix h-full min-w-1 transition-[flex-grow] duration-500 ease-(--ease-out) motion-reduce:transition-none"
            style:flex-grow={r.n}
            style:background={MIX[i % MIX.length]}
            style:--i={i}
          ></span>
        {/each}
      </div>
      <ul class="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {#if list}
          {#each list as r, i (r.value)}
            <li class="flex items-center gap-1.5">
              <span class="size-2 rounded-full" style:background={MIX[i % MIX.length]} aria-hidden="true"></span>
              {r.name}
              <span class="font-medium tabular-nums">{compact(r.n)}</span>
              <span class="text-muted-foreground tabular-nums">{rate(r.n, sum)}%</span>
            </li>
          {/each}
        {:else}
          <li class="h-5 w-40 rounded bg-muted"></li>
        {/if}
      </ul>
    </figure>
  {/if}
{/snippet}

{#snippet osIcon(r)}
  <span class="flex w-4 shrink-0 justify-center"><OsIcon name={r.value} /></span>
{/snippet}

{#snippet change(kind, pair)}
  {@const t = trend(pair[0], pair[1])}
  {#if t}
    <span class="inline-flex items-center gap-0.5 text-xs tabular-nums {t.dir === 'flat' ? 'text-muted-foreground' : kind === 'bad' ? (t.dir === 'up' ? 'text-destructive' : 'text-success') : kind === 'slow' ? (t.dir === 'up' ? 'text-warning' : 'text-success') : 'text-muted-foreground'}">
      {#if t.dir !== "flat"}
        <Icon name={t.dir === "up" ? "trendUp" : "trendDown"} size={12} stroke={2.25} />
        <span class="sr-only">{t.dir === "up" ? "Up" : "Down"}</span>
      {/if}
      {t.text}
      <span class="text-faint-foreground">vs. previous</span>
    </span>
  {:else}
    <span class="text-xs text-muted-foreground">No earlier data</span>
  {/if}
{/snippet}

{#snippet tile(label, color, pair, format, kind, of, id)}
  {@const on = id && metric === id}
  <svelte:element
    this={id ? "button" : "div"}
    type={id ? "button" : undefined}
    aria-pressed={id ? on : undefined}
    data-metric={id}
    aria-keyshortcuts={id ? String(METRICS.findIndex((m) => m.id === id) + 1) : undefined}
    onclick={id ? () => (metric = id) : undefined}
    class="tile flex min-w-0 flex-col items-start gap-0.5 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 {id ? 'cursor-pointer' : ''} {on ? 'bg-background' : ''}"
  >
    <span class="flex items-center gap-1.5 text-sm {on ? 'text-foreground' : 'text-muted-foreground'}">
      {#if color}<span class="size-2 rounded-full" style:background={color}></span>{/if}
      {label}
    </span>
    <Skeleton loading={!stats}>
      <span class="flex flex-col items-start gap-0.5">
        <span class="flex items-baseline gap-2">
          <Odometer class="text-2xl font-semibold" value={pair?.[0] ?? 0} {format} />
          {#if of}
            <span class="text-sm text-muted-foreground tabular-nums">
              <Odometer value={rate(pair?.[0], of)} format={(v) => `${v}%`} /><span class="sr-only"> of challenges</span>
            </span>
          {/if}
        </span>
        {@render change(kind, pair ?? [])}
      </span>
    </Skeleton>
  </svelte:element>
{/snippet}

<NotchFilter />

<div class="flex min-h-dvh flex-col bg-sidebar text-foreground md:p-2 print:block print:min-h-0 print:bg-background print:p-0">
<div class="relative flex flex-1 flex-col bg-background md:rounded-lg print:block">
  <header class="notch-shadow z-40 flex print:hidden flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border bg-background px-4 py-2.5 md:pointer-events-none md:h-11 md:flex-nowrap md:items-stretch md:gap-0 md:border-b-0 md:bg-transparent md:p-0 md:[&>*]:pointer-events-auto">
    <div class="relative flex min-w-0 flex-1 items-center gap-2.5 md:flex-none md:rounded-tl-lg md:bg-sidebar md:ps-4 md:pe-2">
      <a
        class="-ms-1 inline-flex min-h-8 items-center gap-2 rounded-md px-1 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        href="https://trycap.dev"
        target="_blank"
        rel="noreferrer"
      >
        <img src="./public/logo-small.webp" alt="" width="22" height="22" class="size-[22px] shrink-0" />
        Cap
      </a>
      <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
    </div>
    <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M0 0H28C21.5 0 18.6 3 17.6 8.4L14 35.6C13 41 10 44 4 44H0Z" /><clipPath id="share-ear-l"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#share-ear-l)" d="M28 .5C21.8.5 19.1 3 18.1 8.5L14.5 35.5C13.5 40.8 10.3 43.5 4 43.5H0" /></svg>
    <div class="hidden flex-1 md:pointer-events-none md:block"></div>
    {#if !error}
      <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M28 0H0C6.5 0 9.4 3 10.4 8.4L14 35.6C15 41 18 44 24 44H28Z" /><clipPath id="share-ear-r"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#share-ear-r)" d="M0 .5C6.2.5 8.9 3 9.9 8.5L13.5 35.5C14.5 40.8 17.7 43.5 24 43.5H28" /></svg>
      <div class="relative flex shrink-0 items-center gap-1.5 md:rounded-tr-lg md:bg-sidebar md:pt-[3px] md:pe-[3px] md:pb-1 md:ps-1">
        <RangePicker value={range} ranges={RANGES} onchange={setRange} />
        <Button icon aria-label="Download CSV" title="Download CSV" disabled={!series.length} onclick={download}>
          <svg viewBox="0 0 256 256" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" /></svg>
        </Button>
        <Button icon aria-label="Refresh" title="Refresh" disabled={!share} onclick={() => load(true)}>
          <Icon name="refresh" size={15} class={loading && share ? "motion-safe:animate-spin" : ""} />
        </Button>
        <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
      </div>
    {/if}
  </header>

  <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-5 pb-10 md:px-5 print:block print:space-y-4 print:px-0">
    {#if !error}
      <div class="flex min-w-0 flex-col gap-1.5 pt-1 pb-2 md:pt-3">
        <Skeleton class="min-w-0 self-start" loading={!share} label="Loading stats">
          <h1 class="text-2xl/tight font-semibold tracking-[-0.015em] text-balance [overflow-wrap:anywhere] md:text-[28px]/tight">{share?.name ?? "Shared stats"}</h1>
        </Skeleton>
        <Skeleton class="self-start" loading={!share}>
          <p class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span>{span || (share ? `No data in ${rangeInfo.long}` : "Jan 1 to Jan 7, 2026, UTC")}</span>
            {#if ago}<span>{ago}</span>{/if}
            {#if expires}<span class={expires.soon ? "text-warning" : "text-faint-foreground"}>Link expires {expires.text}</span>{/if}
          </p>
        </Skeleton>
      </div>
    {:else}
      <h1 class="sr-only">Stats unavailable</h1>
    {/if}
    {#if error}
      <div class="flex flex-1 items-center justify-center py-16" role="alert">
        {#if retryable}
          <Empty title="Couldn't load these stats">
            {error}
            {#snippet action()}
              <Button disabled={loading} onclick={() => load(true)}>
                <Icon name="refresh" size={15} class={loading ? "motion-safe:animate-spin" : ""} />
                Try again
              </Button>
            {/snippet}
          </Empty>
        {:else}
          <Empty title="This link doesn't work">{error} Ask the person who shared it for a new link.</Empty>
        {/if}
      </div>
    {:else}
      {#if notice}<p class="text-sm text-pretty text-warning" role="status">{notice}</p>{/if}
      <Card variant="layered" class="print:break-inside-avoid" role="region" aria-label="Traffic">
        <div class="grid grid-cols-2 pb-1 sm:grid-cols-4" role="group" aria-label="Chart metric">
          {@render tile("Challenges", "var(--chart-1)", stats?.challenges, compact, null, null, "challenges")}
          {@render tile("Passed", "var(--success)", stats?.solved, compact, null, stats?.challenges[0], "solved")}
          {@render tile("Failed", "var(--faint-foreground)", stats?.failed, compact, "bad", stats?.challenges[0], "failed")}
          {@render tile("Avg. solve time", null, stats?.avg, latency, "slow")}
        </div>

        <CardContent class="gap-2 pt-5 pb-4 transition-opacity duration-200 {loading && share ? 'opacity-60' : ''}">
          <Skeleton data={share && { series, bucket, total: stats?.challenges[0] }} sample={sampleChart} label="Loading chart">
            {#snippet children(c)}
              {#if !c.series.length || !c.total}
                <p class="flex h-[15rem] items-center justify-center text-center text-sm text-muted-foreground">No traffic in {rangeInfo.long}</p>
              {:else}
                <TrafficChart series={c.series} bucket={c.bucket} {metric} metrics={METRICS} previous={compare ? previousSeries : null} />
              {/if}
            {/snippet}
          </Skeleton>
          {#if previousSeries}
            <div class="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                class="-me-2 {compare ? 'bg-nav-hover text-foreground' : 'text-muted-foreground'}"
                aria-pressed={compare}
                onclick={() => (compare = !compare)}
              >
                <span class="h-0.5 w-3 rounded-full bg-current" aria-hidden="true"></span>
                Compare with previous
              </Button>
            </div>
          {/if}
        </CardContent>
      </Card>

      <ShareBreakdown tabs={geoTabs.countries} note={geoNote} stale={geoStale} figure={worldMap} onhover={(code) => (hot = code)} />
      <div class="grid gap-4 lg:grid-cols-2">
        <ShareBreakdown tabs={geoTabs.networks} note={geoNote} stale={geoStale} />
        <ShareBreakdown tabs={geoTabs.clients.slice(1)} title="Devices and systems" note={geoNote} stale={geoStale} figure={deviceMix} stack />
      </div>
    {/if}
  </main>

  <footer class="mx-auto flex w-full max-w-6xl flex-wrap items-center {error ? 'justify-center' : ''} gap-x-4 gap-y-2 px-4 pb-8 text-sm text-muted-foreground md:px-5">
    <a
      class="inline-flex items-center gap-2 rounded-sm underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline"
      href="https://trycap.dev"
      target="_blank"
      rel="noreferrer"
    >
      Stats from Cap, the open source CAPTCHA
    </a>
  </footer>
  <div class="pointer-events-none absolute inset-0 z-50 hidden rounded-[inherit] print:hidden shadow-[inset_0_0_0_1px_var(--border)] md:block" aria-hidden="true"></div>
</div>

<style>
  .map {
    --card: var(--background);
  }

  .tile {
    transition: background-color 160ms ease-out;
  }

  @media (hover: hover) {
    button.tile:not([aria-pressed="true"]):hover {
      background-color: color-mix(in oklab, var(--background) 50%, transparent);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .mix {
      transform-origin: left;
      animation: mix-in 560ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i) * 60ms) both;
    }

    .mix:dir(rtl) {
      transform-origin: right;
    }
  }

  @keyframes mix-in {
    from {
      scale: 0 1;
      opacity: 0;
    }
  }
</style>
</div>
