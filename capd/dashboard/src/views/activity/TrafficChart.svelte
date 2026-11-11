<script>
import { compact } from "../../lib/format.js";
import { dtf, numFmt, t } from "../../lib/i18n.svelte.js";

let { series, bucket, metric, metrics } = $props();

const DAY = 86_400_000;

let plot = $state();
let hover = $state(null);
let stagger = $state(!!window.capRise);
let held = $state(
  !stagger &&
    !window.capRisen &&
    new URLSearchParams(location.search).has("hold"),
);
let rises = $state(0);
let shown = metric;
let settle;

const rise = () => {
  window.capRise = false;
  window.capRisen = true;
  held = false;
  rises++;
  stagger = true;
  clearTimeout(settle);
  settle = setTimeout(() => {
    stagger = false;
  }, 1250);
};

if (stagger) {
  window.capRise = false;
  window.capRisen = true;
  settle = setTimeout(() => {
    stagger = false;
  }, 1250);
}

$effect.pre(() => {
  if (metric === shown) return;
  shown = metric;
  rise();
});

$effect(() => {
  window.addEventListener("cap:rise", rise);
  return () => {
    window.removeEventListener("cap:rise", rise);
    clearTimeout(settle);
  };
});

const current = $derived(metrics.find((m) => m.id === metric));
const color = (id) => metrics.find((m) => m.id === id)?.color;
const parts = $derived(
  series.map((s) =>
    metric === "challenges"
      ? [
          [Math.max(0, (s.solved ?? 0) - (s.flagged ?? 0)), color("solved")],
          [s.flagged ?? 0, color("flagged")],
          [s.failed ?? 0, color("failed")],
          [s.blocked ?? 0, color("blocked")],
        ]
      : [[s[metric] ?? 0, current?.color]],
  ),
);
const values = $derived(parts.map((p) => p.reduce((a, [v]) => a + v, 0)));

const scale = $derived.by(() => {
  const peak = Math.max(...values, 0);
  if (!peak) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = peak / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const nice = Math.max(1, step);
  return {
    max: nice * 4,
    ticks: [0, 1, 2, 3, 4].map((i) => i * nice),
  };
});

const gap = $derived(
  series.length > 60 ? 1 : series.length > 32 ? 2 : series.length > 16 ? 3 : 4,
);

const hourFmt = dtf({
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = dtf({
  month: "short",
  day: "numeric",
});
const longFmt = dtf({
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const utcDayFmt = dtf({
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const utcLongDayFmt = dtf({
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const multiDay = $derived(
  bucket < DAY && series.length > 1 && series.at(-1).b - series[0].b > DAY,
);

const ticks = $derived.by(() => {
  const all = series.map((_, i) => i);
  const picked = multiDay
    ? all.filter((i) => new Date(series[i].b).getHours() < bucket / 3_600_000)
    : all;
  const every = Math.max(1, Math.ceil(picked.length / 7));
  return new Set(picked.filter((_, j) => j % every === 0));
});

const tickLabel = (b) =>
  bucket >= DAY
    ? utcDayFmt.format(new Date(b))
    : multiDay
      ? dayFmt.format(new Date(b))
      : hourFmt.format(new Date(b));

const spanLabel = (b) =>
  bucket > DAY
    ? t("{from} to {to}, UTC", {
        from: utcLongDayFmt.format(new Date(b)),
        to: utcLongDayFmt.format(new Date(b + bucket - DAY)),
      })
    : bucket === DAY
      ? `${utcLongDayFmt.format(new Date(b))}, UTC`
      : t("{from} to {to}", {
          from: longFmt.format(new Date(b)),
          to: hourFmt.format(new Date(b + bucket)),
        });

const pick = (e) => {
  const rect = plot.getBoundingClientRect();
  const i = Math.floor(((e.clientX - rect.left) / rect.width) * series.length);
  hover = i >= 0 && i < series.length ? i : null;
};

const summary = $derived(
  t("{label}: {total} in {count} intervals, peaking at {peak}.", {
    label: current?.label ?? "",
    total: numFmt(values.reduce((a, b) => a + b, 0)),
    count: series.length,
    peak: numFmt(Math.max(0, ...values)),
  }),
);
</script>

<div class="grid grid-cols-[auto_1fr] gap-x-3">
  <div class="relative h-56 w-8 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each scale.ticks as tick (tick)}
      <span class="absolute right-0 leading-none" style:bottom="{(tick / scale.max) * 100}%" style:transform="translateY(50%)">
        {compact(tick)}
      </span>
    {/each}
  </div>

  <div
    bind:this={plot}
    class="relative h-56"
    role="img"
    aria-label={summary}
    onpointermove={pick}
    onpointerleave={() => (hover = null)}
  >
    {#each scale.ticks as tick (tick)}
      <div
        class="pointer-events-none absolute inset-x-0 border-t {tick === 0 ? 'border-border' : 'border-dashed border-border'}"
        style:bottom="{(tick / scale.max) * 100}%"
      ></div>
    {/each}

    {#key `${metric}:${rises}`}
    <div data-bone="block" class="absolute inset-0 flex items-end" style:gap="{gap}px">
      {#each series as s, i (s.b)}
        {@const v = values[i]}
        <div class="relative flex h-full min-w-0 flex-1 items-end">
          {#if hover === i}
            <div class="absolute inset-0 -mx-px rounded-[3px] bg-foreground/[0.04]"></div>
          {/if}
          <div
            class="relative flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px] ease-(--ease-out) motion-reduce:transition-none {held ? 'bar-held' : stagger ? 'bar-rise' : 'transition-[height,opacity] duration-300'}"
            style:height="{v ? Math.max(2, (v / scale.max) * 100) : 0}%"
            style:animation-delay={stagger ? `${Math.round((i / series.length) * 650)}ms` : null}
            style:opacity={hover == null || hover === i ? 1 : 0.55}
          >
            {#each parts[i] as [n, c], j (j)}
              {#if n}<span class="w-full shrink-0" style:height="{(n / v) * 100}%" style:background={c}></span>{/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
    {/key}

    {#if hover != null && series[hover]}
      {@const s = series[hover]}
      {@const x = ((hover + 0.5) / series.length) * 100}
      <div
        class="pointer-events-none absolute top-2 z-10 w-56 rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]"
        style:left="{x}%"
        style:transform="translateX({x < 22 ? '8px' : x > 78 ? 'calc(-100% - 8px)' : '-50%'})"
      >
        <p class="mb-2 font-medium text-muted-foreground">{spanLabel(s.b)}</p>
        <ul class="flex flex-col gap-1.5">
          {#each metrics.filter((m) => m.chart) as m (m.id)}
            <li class="flex items-center gap-2 {m.id === metric ? 'font-medium text-foreground' : 'text-muted-foreground'}">
              <span class="size-2 shrink-0 rounded-full" style:background={m.color}></span>
              {m.label}
              <span class="ml-auto tabular-nums {m.id === metric ? 'text-foreground' : ''}">{numFmt(s[m.id] ?? 0)}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div></div>
  <div class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each series as s, i (s.b)}
      {#if ticks.has(i)}
        <span
          class="absolute whitespace-nowrap"
          style:left="{(multiDay ? i : i + 0.5) / series.length * 100}%"
          style:transform="translateX(-50%)"
        >
          {tickLabel(s.b)}
        </span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .bar-held {
    transform-origin: bottom;
    scale: 1 0;
  }

  .bar-rise {
    transform-origin: bottom;
    animation: bar-rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes bar-rise {
    from {
      scale: 1 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-rise {
      animation: none;
    }

    .bar-held {
      scale: none;
    }
  }
</style>
