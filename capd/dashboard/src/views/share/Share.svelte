<script>
import { onMount } from "svelte";
import {
  Button,
  Empty,
  RangePicker,
  Select,
  Skeleton,
} from "../../components/cap/index.js";
import NotchFilter from "../../components/cap/NotchFilter.svelte";
import Icon from "../../components/Icon.svelte";
import { Card, CardContent } from "../../components/ui/index.js";
import { url } from "../../lib/api.js";
import { compact, latency, trend } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";
import { dtf, LOCALES, locale, setLocale, t } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import OsIcon from "../activity/OsIcon.svelte";
import TrafficChart from "../activity/TrafficChart.svelte";
import ShareBreakdown from "./ShareBreakdown.svelte";

const RANGES = $derived([
  { id: "today", short: "1d", label: t("Today"), long: t("today") },
  {
    id: "yesterday",
    short: "",
    label: t("Yesterday"),
    long: t("yesterday"),
  },
  {
    id: "last7days",
    short: "7d",
    label: t("Past 7 days"),
    long: t("the last 7 days"),
  },
  {
    id: "last28days",
    short: "28d",
    label: t("Past 28 days"),
    long: t("the last 28 days"),
  },
  {
    id: "last91days",
    short: "91d",
    label: t("Past 3 months"),
    long: t("the last 3 months"),
  },
  { id: "alltime", short: "", label: t("All time"), long: t("this period") },
]);

const METRICS = $derived([
  {
    id: "challenges",
    label: t("Challenges"),
    color: "var(--chart-1)",
    chart: true,
  },
  { id: "solved", label: t("Passed"), color: "var(--success)", chart: true },
  {
    id: "failed",
    label: t("Failed"),
    color: "var(--faint-foreground)",
    chart: true,
  },
]);

const token = location.hash.slice(1);

let range = $state("last7days");
let share = $state(null);
let geo = $state(null);
let error = $state(token ? "" : "This link is missing its share token.");
let notice = $state("");
let loading = $state(false);
let seq = 0;

const rangeInfo = $derived(RANGES.find((r) => r.id === range));

const dayFmt = dtf({
  month: "short",
  day: "numeric",
  year: "numeric",
});

const utcDayFmt = dtf({
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const utcShortFmt = dtf({
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
  return t("{from} to {to}, UTC", { from: first, to: last });
});

const expires = $derived(
  share?.expires ? dayFmt.format(new Date(share.expires)) : "",
);

const rows = (items, value, name) =>
  geo
    ? (items ?? []).map((item) => ({
        value: value(item),
        name: name(item),
        n: item.count,
      }))
    : null;

const geoTabs = $derived.by(() => ({
  places: [
    {
      id: "countries",
      label: t("Countries"),
      column: t("Country"),
      rows: rows(
        geo?.countries,
        (c) => c.code,
        (c) => countryName(c.code),
      ),
      total: geo?.totalCountry,
      icon: flagIcon,
      image: (r) => flagUrl(r.value),
      empty: t("No location data yet"),
    },
    {
      id: "networks",
      label: t("Networks"),
      column: t("Network"),
      rows: rows(
        geo?.asns,
        (a) => a.name,
        (a) => a.name,
      ),
      total: geo?.totalAsn,
      empty: t("No network data yet"),
    },
  ],
  clients: [
    {
      id: "devices",
      label: t("Devices"),
      column: t("Device"),
      rows: rows(
        geo?.platforms,
        (p) => p.name,
        (p) => p.name,
      ),
      total: geo?.totalPlatform,
      empty: t("No device data yet"),
    },
    {
      id: "os",
      label: t("Systems"),
      column: t("Operating system"),
      rows: rows(
        geo?.oses,
        (o) => o.name,
        (o) => o.name,
      ),
      total: geo?.totalOs,
      icon: osIcon,
      empty: t("No operating system data yet"),
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
  const data = await get(`share/${encodeURIComponent(token)}/geo-stats`);
  if (data?.error) {
    geo ??= {};
    return;
  }
  geo = data;
}

async function load(withGeo = false) {
  const id = ++seq;
  loading = true;
  if (withGeo) loadGeo();
  const data = await get(
    `share/${encodeURIComponent(token)}?chartDuration=${range}`,
  );
  if (id !== seq) return;
  loading = false;
  if (data?.shown && share) {
    notice = data.error;
    return;
  }
  if (!data?.stats) {
    error = data?.shown
      ? data.error
      : "This share link is invalid or has expired.";
    return;
  }
  error = "";
  notice = "";
  share = data;
}

$effect(() => {
  document.title = error
    ? t("Stats unavailable")
    : share
      ? t("{name} · Cap stats", { name: share.name })
      : t("Cap stats");
});

const setRange = (id) => {
  if (id === range) return;
  range = id;
  load();
};

onMount(() => {
  const reload = () => location.reload();
  window.addEventListener("hashchange", reload);
  if (token) load(true);
  return () => window.removeEventListener("hashchange", reload);
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

{#snippet osIcon(r)}
  <span class="flex w-4 shrink-0 justify-center"><OsIcon name={r.value} /></span>
{/snippet}

{#snippet change(kind, pair)}
  {@const trendInfo = trend(pair[0], pair[1])}
  {#if trendInfo}
    <span class="inline-flex items-center gap-0.5 text-xs tabular-nums {trendInfo.dir === 'flat' ? 'text-muted-foreground' : kind === 'bad' ? (trendInfo.dir === 'up' ? 'text-destructive' : 'text-success') : kind === 'slow' ? (trendInfo.dir === 'up' ? 'text-warning' : 'text-success') : 'text-muted-foreground'}">
      {#if trendInfo.dir !== "flat"}
        <Icon name={trendInfo.dir === "up" ? "trendUp" : "trendDown"} size={12} stroke={2.25} />
        <span class="sr-only">{trendInfo.dir === "up" ? t("Up") : t("Down")}</span>
      {/if}
      {trendInfo.text}
    </span>
  {:else}
    <span class="text-xs text-muted-foreground">{t("No earlier data")}</span>
  {/if}
{/snippet}

{#snippet tile(label, color, value, pair, kind)}
  <div class="flex min-w-0 flex-col items-start gap-0.5 px-4 py-3">
    <span class="flex items-center gap-1.5 text-sm text-muted-foreground">
      {#if color}<span class="size-2 rounded-full" style:background={color}></span>{/if}
      {label}
    </span>
    <Skeleton loading={!stats}>
      <span class="flex flex-col items-start gap-0.5">
        <span class="text-2xl font-semibold tabular-nums">{value}</span>
        {@render change(kind, pair ?? [])}
      </span>
    </Skeleton>
  </div>
{/snippet}

<NotchFilter />

<div class="flex min-h-dvh flex-col bg-sidebar text-foreground md:p-2">
<div class="relative flex flex-1 flex-col bg-background md:rounded-lg">
  <header class="notch-shadow z-40 flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-border bg-background px-4 py-2.5 md:pointer-events-none md:h-11 md:flex-nowrap md:items-stretch md:gap-0 md:border-b-0 md:bg-transparent md:p-0 md:[&>*]:pointer-events-auto">
    <div class="relative flex min-w-0 flex-1 items-center gap-2.5 md:flex-none md:rounded-tl-lg md:bg-sidebar md:ps-4 md:pe-2">
      <img src="./public/logo-small.webp" alt="" width="22" height="22" class="size-[22px] shrink-0" />
      <Skeleton class="min-w-0" loading={!share && !error} label={t("Loading stats")}>
        <h1 class="truncate text-[15px] font-medium" title={error ? undefined : share?.name}>{error ? t("Stats unavailable") : (share?.name ?? t("Shared stats"))}</h1>
      </Skeleton>
      <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
    </div>
    <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M0 0H28C21.5 0 18.6 3 17.6 8.4L14 35.6C13 41 10 44 4 44H0Z" /><clipPath id="share-ear-l"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#share-ear-l)" d="M28 .5C21.8.5 19.1 3 18.1 8.5L14.5 35.5C13.5 40.8 10.3 43.5 4 43.5H0" /></svg>
    <div class="hidden flex-1 md:pointer-events-none md:block"></div>
    {#if !error}
      <svg class="hidden h-11 w-7 shrink-0 md:block" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M28 0H0C6.5 0 9.4 3 10.4 8.4L14 35.6C15 41 18 44 24 44H28Z" /><clipPath id="share-ear-r"><rect y="1.25" width="28" height="44" /></clipPath><path fill="none" stroke="var(--border)" clip-path="url(#share-ear-r)" d="M0 .5C6.2.5 8.9 3 9.9 8.5L13.5 35.5C14.5 40.8 17.7 43.5 24 43.5H28" /></svg>
      <div class="relative flex shrink-0 items-center gap-1.5 max-md:w-full md:rounded-tr-lg md:bg-sidebar md:pt-[3px] md:pe-[3px] md:pb-1 md:ps-1">
        <RangePicker class="max-md:flex-1 max-md:justify-between" value={range} ranges={RANGES} onchange={setRange} />
        <Button icon aria-label={t("Refresh")} title={t("Refresh")} disabled={!share} onclick={() => load(true)}>
          <Icon name="refresh" size={15} class={loading && share ? "motion-safe:animate-spin" : ""} />
        </Button>
        <span class="absolute start-0 end-0 bottom-0 hidden h-px bg-border md:block"></span>
      </div>
    {/if}
  </header>

  <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pt-5 pb-10 md:px-5">
    {#if !error && (span || !share)}
      <Skeleton class="-mb-1" loading={!share}>
        <p class="text-sm text-muted-foreground tabular-nums">{span || "Jan 1 to Jan 7, 2026, UTC"}</p>
      </Skeleton>
    {/if}
    {#if error}
      <div class="flex flex-1 items-center justify-center py-16" role="alert">
        <Empty title={t("This link doesn't work")}>{t(error)} {t("Ask the person who shared it for a new link.")}</Empty>
      </div>
    {:else}
      {#if notice}<p class="text-sm text-pretty text-destructive" role="status">{t(notice)}</p>{/if}
      <Card variant="layered" role="region" aria-label={t("Traffic")}>
        <div class="grid grid-cols-2 pb-1 sm:grid-cols-4">
          {@render tile(t("Challenges"), "var(--chart-1)", compact(stats?.challenges[0]), stats?.challenges)}
          {@render tile(t("Passed"), "var(--success)", compact(stats?.solved[0]), stats?.solved)}
          {@render tile(t("Failed"), "var(--faint-foreground)", compact(stats?.failed[0]), stats?.failed, "bad")}
          {@render tile(t("Avg. solve time"), null, latency(stats?.avg[0]), stats?.avg, "slow")}
        </div>

        <CardContent class="gap-2 pt-5 pb-4 transition-opacity duration-200 {loading && share ? 'opacity-60' : ''}">
          <Skeleton data={share && { series, bucket, total: stats?.challenges[0] }} sample={sampleChart} label={t("Loading chart")}>
            {#snippet children(c)}
              {#if !c.series.length || !c.total}
                <p class="flex h-[15rem] items-center justify-center text-center text-sm text-muted-foreground">{t("No traffic in {range}", { range: rangeInfo.long })}</p>
              {:else}
                <TrafficChart series={c.series} bucket={c.bucket} metric="challenges" metrics={METRICS} />
              {/if}
            {/snippet}
          </Skeleton>
        </CardContent>
      </Card>

      <div class="grid gap-4 lg:grid-cols-2">
        <ShareBreakdown tabs={geoTabs.places} note={t("All time")} />
        <ShareBreakdown tabs={geoTabs.clients} note={t("All time")} />
      </div>
    {/if}
  </main>

  <footer class="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-8 text-sm text-muted-foreground md:px-5">
    <a
      class="inline-flex items-center gap-2 rounded-sm underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-foreground [@media(hover:hover)]:hover:underline"
      href="https://trycap.dev"
      target="_blank"
      rel="noreferrer"
    >
      {t("Stats from Cap, the open source CAPTCHA")}
    </a>
    <div class="flex flex-wrap items-center gap-3">
      {#if expires && !error}<span>{t("This link expires {date}", { date: expires })}</span>{/if}
      <Select
        size="sm"
        class="w-auto shrink-0"
        aria-label={t("Language")}
        options={LOCALES}
        bind:value={() => locale.value, (v) => setLocale(v)}
      />
    </div>
  </footer>
  <div class="pointer-events-none absolute inset-0 z-50 hidden rounded-[inherit] shadow-[inset_0_0_0_1px_var(--border)] md:block" aria-hidden="true"></div>
</div>
</div>
