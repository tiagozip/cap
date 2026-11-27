<script>
import { tick, untrack } from "svelte";
import Icon from "../../components/ui/icon/Icon.svelte";
import { compact } from "../../lib/format.js";

let { series, bucket, metric, metrics, onpick, previous } = $props();

const DAY = 86_400_000;

let plot = $state();
let plotWidth = $state(800);
let barsEl = $state();
let hover = $state(null);
let zoom = $state(null);
let brush = $state(null);
let tipAt = $state(0);
let glide = $state(false);
const startHeld =
  !window.capRise &&
  !window.capRisen &&
  new URLSearchParams(location.search).has("hold");
let held = $state(startHeld);
let stagger = $state(!startHeld);
let rises = $state(0);
let shape = untrack(() => `${bucket}:${series.length}`);
let settle;

const calm = () => {
  clearTimeout(settle);
  settle = setTimeout(() => {
    stagger = false;
  }, 1100);
};

const rise = () => {
  window.capRise = false;
  window.capRisen = true;
  held = false;
  rises++;
  stagger = true;
  calm();
};

if (!startHeld) {
  if (window.capRise) window.capRisen = true;
  window.capRise = false;
  calm();
}

$effect.pre(() => {
  const next = `${bucket}:${series.length}`;
  if (next === shape) return;
  shape = next;
  rise();
});

$effect(() => {
  if (untrack(() => rises) === 0 && plot?.closest(".enter")) stagger = false;
});

$effect(() => {
  window.addEventListener("cap:rise", rise);
  return () => {
    window.removeEventListener("cap:rise", rise);
    clearTimeout(settle);
  };
});

$effect.pre(() => {
  bucket;
  zoom = null;
});

const view = $derived.by(() => {
  if (!zoom) return series;
  const inside = series.filter((s) => s.b >= zoom[0] && s.b <= zoom[1]);
  return inside.length > 1 ? inside : series;
});
const zoomed = $derived(view !== series);

const current = $derived(metrics.find((m) => m.id === metric));
const plain = (v) => v.toLocaleString();
const show = $derived(current?.format ?? plain);
const mean = (list) => {
  const kept = list.filter((v) => v > 0);
  return kept.length
    ? Math.round(kept.reduce((a, b) => a + b, 0) / kept.length)
    : 0;
};
const color = (id) => metrics.find((m) => m.id === id)?.color;
const parts = $derived(
  view.map((s) =>
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

const before = $derived.by(() => {
  const rows = previous;
  if (!rows?.length) return null;
  const start = series.indexOf(view[0]);
  return view.map((_, i) => {
    const r = rows[start + i];
    if (!r) return null;
    return metric === "challenges"
      ? (r.solved ?? 0) + (r.failed ?? 0) + (r.blocked ?? 0)
      : (r[metric] ?? 0);
  });
});

const beforeRaw = $derived.by(() => {
  if (!previous?.length) return null;
  const start = series.indexOf(view[0]);
  return view.map((_, i) => previous[start + i]?.[metric] ?? null);
});

const stepPath = $derived.by(() => {
  if (!before) return "";
  let d = "";
  let pen = false;
  before.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    const y = 100 - (v / scale.max) * 100;
    d += pen ? `V${y}H${i + 1}` : `M${i} ${y}H${i + 1}`;
    pen = true;
  });
  return d;
});

const spikes = $derived.by(() => {
  const rateOf = (s) =>
    s.challenges ? ((s.flagged ?? 0) + (s.blocked ?? 0)) / s.challenges : 0;
  const mid = (list) => {
    const sorted = list.filter((v) => v > 0).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const rate = view.map(rateOf);
  const usual = mid(series.map(rateOf));
  const volume = mid(series.map((s) => s.challenges ?? 0));
  if (!usual || series.length < 12) return new Map();
  const bar = Math.max(usual * 2, usual + 0.1);
  const runs = [];
  view.forEach((s, i) => {
    if (rate[i] < bar || (s.challenges ?? 0) < volume * 0.3) return;
    const last = runs.at(-1);
    if (last && last.end === i - 1) {
      last.end = i;
      if (rate[i] > rate[last.at]) last.at = i;
    } else runs.push({ at: i, end: i });
  });
  return new Map(
    runs
      .sort((a, b) => rate[b.at] - rate[a.at])
      .slice(0, 3)
      .map((r) => [r.at, { rate: rate[r.at], usual }]),
  );
});

const pct = (v) => `${Math.round(v * 100)}%`;
const share = (v) => (v > 0 && v < 0.01 ? "<1%" : pct(v));

const scale = $derived.by(() => {
  const peak = Math.max(...values, ...(before ?? []).map((v) => v ?? 0), 0);
  if (!peak) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const top = peak * 1.04;
  const mag = 10 ** Math.floor(Math.log10(top / 5));
  const [step, count] = [1, 2, 2.5, 5, 10, 20]
    .map((m) => Math.max(1, m * mag))
    .map((st) => [st, Math.max(2, Math.ceil(top / st))])
    .filter(([, n]) => n <= 6)
    .reduce((best, c) => (c[0] * c[1] < best[0] * best[1] ? c : best));
  return {
    max: step * count,
    ticks: Array.from({ length: count + 1 }, (_, i) => i * step),
  };
});

const gap = $derived(
  view.length > 60 ? 1 : view.length > 32 ? 2 : view.length > 16 ? 3 : 4,
);

const hourFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const longFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const utcDayFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const utcLongDayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const HOUR = 3_600_000;
const axisHourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

const mode = $derived(
  bucket >= DAY
    ? "day"
    : view.length > 1 && view.at(-1).b - view[0].b > 3 * DAY
      ? "multi"
      : "hour",
);

const ticks = $derived.by(() => {
  const all = view.map((_, i) => i);
  const most = Math.max(2, Math.min(7, Math.floor(plotWidth / 72)));
  if (mode === "hour") {
    const hours = (view.at(-1).b + bucket - view[0].b) / HOUR;
    const step =
      [1, 2, 3, 4, 6, 12, 24].find(
        (h) => h * HOUR >= bucket && hours / h <= most,
      ) ?? 24;
    return new Set(
      all.filter((i) => {
        const d = new Date(view[i].b);
        return d.getMinutes() === 0 && d.getHours() % step === 0;
      }),
    );
  }
  const picked =
    mode === "multi"
      ? all.filter((i) => new Date(view[i].b).getHours() < bucket / HOUR)
      : all;
  const mondays = picked.filter((i) => {
    const d = new Date(view[i].b);
    return (mode === "day" ? d.getUTCDay() : d.getDay()) === 1;
  });
  if (bucket <= DAY && picked.length > most * 2 && mondays.length >= 2) {
    const every = Math.max(1, Math.ceil(mondays.length / most));
    return new Set(mondays.filter((_, j) => j % every === 0));
  }
  const every = Math.max(1, Math.ceil(picked.length / most));
  return new Set(picked.filter((_, j) => j % every === 0));
});

const tickLabel = (b) => {
  const d = new Date(b);
  if (mode === "day") return utcDayFmt.format(d);
  if (mode === "multi" || d.getHours() === 0) return dayFmt.format(d);
  return axisHourFmt.format(d);
};

const spanLabel = (b) =>
  bucket > DAY
    ? `${utcLongDayFmt.format(new Date(b))} to ${utcLongDayFmt.format(new Date(b + bucket - DAY))}, UTC`
    : bucket === DAY
      ? `${utcLongDayFmt.format(new Date(b))}, UTC`
      : `${longFmt.format(new Date(b))} to ${hourFmt.format(new Date(b + bucket))}`;

const rangeLabel = (a, b) =>
  bucket >= DAY
    ? `${utcLongDayFmt.format(new Date(a))} to ${utcLongDayFmt.format(new Date(b + bucket - DAY))}, UTC`
    : `${longFmt.format(new Date(a))} to ${longFmt.format(new Date(b + bucket))}`;

const shortRange = (a, b) => {
  if (bucket >= DAY)
    return `${utcDayFmt.format(new Date(a))} to ${utcDayFmt.format(new Date(b + bucket - DAY))}`;
  const at = (t) =>
    `${dayFmt.format(new Date(t))}, ${axisHourFmt.format(new Date(t))}`;
  return `${at(a)} to ${at(b + bucket)}`;
};

const indexAt = (clientX) => {
  const rect = plot.getBoundingClientRect();
  return Math.min(
    view.length - 1,
    Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * view.length)),
  );
};

const pick = (e) => {
  if (brush) {
    brush = { ...brush, to: indexAt(e.clientX) };
    return;
  }
  const rect = plot.getBoundingClientRect();
  const i = Math.floor(((e.clientX - rect.left) / rect.width) * view.length);
  glide = hover != null;
  hover = i >= 0 && i < view.length ? i : null;
  if (hover != null) tipAt = hover;
};

const span = $derived(
  brush
    ? [Math.min(brush.from, brush.to), Math.max(brush.from, brush.to)]
    : null,
);
const spanTotal = $derived.by(() => {
  if (!span) return 0;
  const part = values.slice(span[0], span[1] + 1);
  return current?.format ? mean(part) : part.reduce((a, b) => a + b, 0);
});
const spanBad = $derived.by(() => {
  if (!span) return null;
  let all = 0;
  let bad = 0;
  for (const s of view.slice(span[0], span[1] + 1)) {
    all += s.challenges ?? 0;
    bad += (s.flagged ?? 0) + (s.blocked ?? 0);
  }
  return all ? bad / all : null;
});

const glideBars = async (from) => {
  await tick();
  if (
    !barsEl ||
    !window.matchMedia("(prefers-reduced-motion: no-preference)").matches
  )
    return;
  barsEl.animate([{ transform: from }, { transform: "none" }], {
    duration: 460,
    easing: "cubic-bezier(0.23, 1, 0.32, 1)",
  });
};

const zoomTo = (a, b) => {
  const n = view.length;
  const k = b - a + 1;
  zoom = [view[a].b, view[b].b];
  hover = null;
  glideBars(`translateX(${(a / n) * 100}%) scaleX(${k / n})`);
};

const unzoom = () => {
  if (!zoomed) return;
  const a = series.findIndex((s) => s.b === view[0].b);
  const n = series.length;
  const k = view.length;
  zoom = null;
  hover = null;
  glideBars(`scaleX(${n / k}) translateX(${(-a / n) * 100}%)`);
};

let tapped = $state(null);

const tap = (e) => {
  const i = indexAt(e.clientX);
  if (tapped === i && hover === i && onpick) {
    onpick(view[i].b, view[i].b + bucket);
    return;
  }
  glide = hover != null;
  hover = i;
  tipAt = i;
  tapped = i;
};

let touchStart = null;

const down = (e) => {
  if (e.pointerType === "touch") {
    touchStart = { x: e.clientX, i: indexAt(e.clientX), id: e.pointerId };
    return;
  }
  tapped = null;
  if (e.button !== 0) return;
  plot.setPointerCapture(e.pointerId);
  const i = indexAt(e.clientX);
  brush = { from: i, to: i };
  hover = null;
};

const up = () => {
  if (!brush) return;
  const [a, b] = span;
  brush = null;
  if (b > a) zoomTo(a, b);
  else if (onpick && view[a]) onpick(view[a].b, view[a].b + bucket);
};

const key = (e) => {
  const last = view.length - 1;
  const moves = {
    ArrowLeft: (i) => Math.max(0, (i ?? last + 1) - 1),
    ArrowRight: (i) => Math.min(last, (i ?? -1) + 1),
    Home: () => 0,
    End: () => last,
  };
  if (e.key === "Escape" && (brush || zoomed)) {
    e.preventDefault();
    if (brush) brush = null;
    else unzoom();
    return;
  }
  if (e.key === "Enter" && (brush || (onpick && view[hover ?? -1]))) {
    e.preventDefault();
    if (brush) up();
    else onpick(view[hover].b, view[hover].b + bucket);
    return;
  }
  if (!moves[e.key]) return;
  e.preventDefault();
  if (e.shiftKey) {
    const from = brush?.from ?? hover ?? 0;
    brush = { from, to: moves[e.key](brush?.to ?? from) };
    hover = null;
    return;
  }
  brush = null;
  glide = hover != null;
  hover = moves[e.key](hover);
  tipAt = hover;
};

const readout = $derived.by(() => {
  if (span)
    return `Selected ${rangeLabel(view[span[0]].b, view[span[1]].b)}, ${current?.label.toLowerCase()} ${show(spanTotal)}`;
  const s = view[hover ?? -1];
  if (!s) return "Use arrow keys to read each interval";
  const k = spikes.get(hover);
  const counts = metrics
    .filter((m) => m.chart)
    .map((m) => `${m.label} ${(m.format ?? plain)(s[m.id] ?? 0)}`)
    .join(", ");
  const was = beforeRaw?.[hover];
  return `${spanLabel(s.b)}: ${counts}${was != null ? `, previous period ${show(was)}` : ""}${k ? `, ${pct(k.rate)} flagged or blocked, usually ${pct(k.usual)}` : ""}`;
});

const summary = $derived(
  `${current?.label}: ${current?.format ? `${show(mean(values))} on average` : plain(values.reduce((a, b) => a + b, 0))} in ${view.length} intervals, peaking at ${show(Math.max(0, ...values))}.${spikes.size ? ` Unusually many flagged or blocked: ${[...spikes.keys()].map((i) => spanLabel(view[i].b)).join("; ")}.` : ""} Use arrow keys to read each interval, Shift with arrows to select a range and Enter to zoom into it${onpick ? ", or Enter on one interval to view its events" : ""}.`,
);
</script>

<div class="relative grid grid-cols-[auto_1fr] gap-x-3">
  <div class="relative h-56 w-8 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each scale.ticks as t (t)}
      <span class="tick level absolute inset-0" style:translate="0 {(-t / scale.max) * 100}%">
        <span class="absolute right-0 bottom-0 translate-y-1/2 leading-none">{(current?.format ?? compact)(t)}</span>
      </span>
    {/each}
  </div>

  <div
    bind:this={plot}
    bind:clientWidth={plotWidth}
    class="plot relative h-56 touch-pan-y rounded-[3px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
    class:brushing={brush}
    role="slider"
    aria-roledescription="chart"
    tabindex="0"
    aria-label={summary}
    aria-valuemin={0}
    aria-valuemax={view.length - 1}
    aria-valuenow={hover ?? 0}
    aria-valuetext={readout}
    onpointerdown={down}
    onpointermove={(e) => {
      if (e.pointerType !== "touch") pick(e);
      else if (brush) brush = { ...brush, to: indexAt(e.clientX) };
      else if (touchStart && Math.abs(e.clientX - touchStart.x) > 8) {
        plot.setPointerCapture(touchStart.id);
        brush = { from: touchStart.i, to: indexAt(e.clientX) };
        hover = null;
        tapped = null;
      }
    }}
    onpointerup={(e) => {
      touchStart = null;
      if (e.pointerType === "touch" && !brush) tap(e);
      else up();
    }}
    onpointercancel={() => {
      brush = null;
      touchStart = null;
    }}
    onpointerleave={(e) => {
      if (!brush && e.pointerType !== "touch") hover = null;
    }}
    onkeydown={key}
    onblur={() => {
      hover = null;
      brush = null;
    }}
  >
    {#each scale.ticks as t (t)}
      <div class="level pointer-events-none absolute inset-0" style:translate="0 {(-t / scale.max) * 100}%">
        <div class="absolute inset-x-0 bottom-0 border-t {t === 0 ? 'border-border' : 'border-dashed border-border'}"></div>
      </div>
    {/each}

    <div class="absolute inset-0 overflow-hidden">
    {#key rises}
    <div bind:this={barsEl} data-bone="block" class="absolute inset-0 flex origin-left items-end" style:gap="{gap}px">
      {#if stepPath}
        <svg
          class="before pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
          viewBox="0 0 {view.length} 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={stepPath} fill="none" stroke="var(--card)" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <path d={stepPath} fill="none" stroke="color-mix(in oklab, var(--foreground) 70%, transparent)" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>
      {/if}
      {#each view as s, i (s.b)}
        {@const v = values[i]}
        {@const live = s.b + bucket > Date.now()}
        <div class="relative flex h-full min-w-0 flex-1 items-end">
          {#if hover === i}
            <div class="absolute inset-0 -mx-px rounded-[3px] bg-foreground/[0.05]"></div>
          {/if}
          {#if spikes.has(i)}
            <span
              class="spike pointer-events-none absolute left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-destructive"
              style:bottom="calc({Math.max(2, (v / scale.max) * 100)}% + 5px)"
            ></span>
          {/if}
          <div
            class="bar relative flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px] {held ? 'bar-held' : stagger ? 'bar-rise' : ''}"
            class:live
            style:height="{v ? Math.max(2, (v / scale.max) * 100) : 0}%"
            style:animation-delay={stagger ? `${Math.round((i / view.length) * 360)}ms` : null}
            style:opacity={span ? (i >= span[0] && i <= span[1] ? 1 : 0.35) : hover == null || hover === i ? 1 : 0.55}
          >
            {#each parts[i] as [n, c], j (j)}
              {#if n}<span class="part w-full shrink-0" style:height="{(n / v) * 100}%" style:background={c}></span>{/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
    {/key}
    </div>


    {#if span}
      {@const left = (span[0] / view.length) * 100}
      {@const width = ((span[1] - span[0] + 1) / view.length) * 100}
      <div class="pointer-events-none absolute inset-y-0 z-10 rounded-[3px] bg-foreground/[0.06] ring-1 ring-foreground/15 ring-inset" style:left="{left}%" style:width="{width}%"></div>
      <div
        class="pointer-events-none absolute top-2 z-20 w-max rounded-lg bg-popover px-2.5 whitespace-nowrap py-2 text-xs text-popover-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]"
        style:left="{Math.min(Math.max(left + width / 2, 14), 86)}%"
        style:translate="-50% 0"
      >
        <p class="font-medium tabular-nums">{#if current?.format}{current.label} {show(spanTotal)}{:else}{plain(spanTotal)} {current?.label.toLowerCase()}{/if}</p>
        <p class="mt-0.5 text-muted-foreground">{rangeLabel(view[span[0]].b, view[span[1]].b)}</p>
        {#if spanBad != null}<p class="mt-0.5 text-muted-foreground"><span class="text-foreground tabular-nums">{share(spanBad)}</span> flagged or blocked</p>{/if}
      </div>
    {/if}

    {#if view[tipAt] && !brush}
      {@const s = view[tipAt]}
      {@const x = ((tipAt + 0.5) / view.length) * 100}
      <div class="tip-track pointer-events-none absolute inset-x-0 top-2 z-10" class:glide style:translate="{x}% 0">
        <div
          class="tip absolute left-0 w-60 rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]"
          class:shown={hover != null}
          style:translate={x < 22 ? "10px 0" : x > 78 ? "calc(-100% - 10px) 0" : "-50% 0"}
        >
          <p class="mb-2 font-medium text-muted-foreground">
            {spanLabel(s.b)}{#if s.b + bucket > Date.now()}<span class="block font-normal text-faint-foreground">In progress</span>{/if}
          </p>
          <ul class="flex flex-col gap-1.5">
            {#each metrics.filter((m) => m.chart) as m (m.id)}
              <li class="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 {m.id === metric ? 'font-medium text-foreground' : 'text-muted-foreground'}">
                <span class="size-2 shrink-0 rounded-full" style:background={m.color}></span>
                {m.label}
                <span class="text-right font-normal text-faint-foreground tabular-nums">{m.id !== "challenges" && !m.format && s.challenges ? share((s[m.id] ?? 0) / s.challenges) : ""}</span>
                <span class="min-w-11 text-right tabular-nums {m.id === metric ? 'text-foreground' : ''}">{(m.format ?? plain)(s[m.id] ?? 0)}</span>
              </li>
            {/each}
          </ul>
          {#if beforeRaw?.[tipAt] != null}
            {@const was = beforeRaw[tipAt]}
            {@const d = was ? (s[metric] ?? 0) / was - 1 : 0}
            <p class="mt-2.5 grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 border-t border-border pt-2.5 text-muted-foreground">
              <span class="h-[1.5px] w-2 shrink-0 rounded-full bg-foreground/70"></span>
              Previous period
              <span class="text-right text-faint-foreground tabular-nums">{was && d ? `${d > 0 ? "+" : "−"}${share(Math.abs(d))}` : ""}</span>
              <span class="min-w-11 text-right tabular-nums">{show(was)}</span>
            </p>
          {/if}
          {#if spikes.has(tipAt)}
            {@const k = spikes.get(tipAt)}
            <ul class="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
              <li class="flex items-center gap-2 font-medium text-foreground">
                <span class="size-2 shrink-0 rounded-full bg-destructive"></span>
                Flagged or blocked
                <span class="ml-auto tabular-nums">{pct(k.rate)}</span>
              </li>
              <li class="flex items-center gap-2 ps-4 text-muted-foreground">
                Usually
                <span class="ml-auto tabular-nums">{pct(k.usual)}</span>
              </li>
            </ul>
          {/if}
          {#if onpick}
            <p class="mt-2.5 border-t border-border pt-2.5 text-faint-foreground">{tapped === tipAt ? "Tap again" : "Click"} to view these events</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div></div>
  <div class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each view as s, i (s.b)}
      {#if ticks.has(i)}
        {@const x = (mode === "day" ? i + 0.5 : i) / view.length}
        <span
          class="absolute whitespace-nowrap"
          style:left="{x * 100}%"
          style:transform="translateX({x * plotWidth < 24 ? '0' : (1 - x) * plotWidth < 24 ? '-100%' : '-50%'})"
        >
          {tickLabel(s.b)}
        </span>
      {/if}
    {/each}
  </div>
  {#if zoomed}
    <div class="zoom-chip absolute top-0 right-0 z-30 flex h-7 items-stretch overflow-hidden rounded-md bg-popover text-xs text-muted-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]">
      {#if onpick}
        <button
          type="button"
          class="chip-btn flex cursor-pointer items-center gap-1 border-e border-border px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [@media(hover:hover)]:hover:text-foreground"
          onclick={() => onpick(view[0].b, view.at(-1).b + bucket)}
        >
          View events
        </button>
      {/if}
      <button
        type="button"
        class="chip-btn flex cursor-pointer items-center gap-1.5 ps-2.5 pe-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [@media(hover:hover)]:hover:text-foreground"
        aria-label="Reset zoom, showing {rangeLabel(view[0].b, view.at(-1).b)}"
        onclick={unzoom}
      >
        <span class="tabular-nums">{shortRange(view[0].b, view.at(-1).b)}</span>
        <Icon name="x" size={13} />
      </button>
    </div>
  {/if}
</div>

<style>
  .bar {
    transform-origin: bottom;
    transition: opacity 120ms ease-out;
  }

  @media (prefers-reduced-motion: no-preference) {
    .before {
      animation: before-in 200ms ease-out both;
    }
  }

  @keyframes before-in {
    from {
      opacity: 0;
    }
  }

  .bar.live .part {
    opacity: 0.5;
  }

  .tip {
    transform-origin: top center;
    opacity: 0;
    scale: 0.97;
    transition:
      opacity 120ms ease-out,
      scale 120ms ease-out;
  }

  .tip.shown {
    opacity: 1;
    scale: 1;
  }

  .bar-held {
    scale: 1 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .level {
      transition: translate 420ms var(--ease-out);
    }

    .spike {
      transition: bottom 420ms var(--ease-out);
    }

    .bar {
      transition:
        height 420ms var(--ease-out),
        opacity 120ms ease-out;
    }

    .part {
      transition: background-color 240ms ease-out;
    }

    .tip-track.glide,
    .tip-track.glide .tip {
      transition:
        translate 160ms var(--ease-out),
        opacity 120ms ease-out,
        scale 120ms ease-out;
    }

    .tick {
      animation: tick-in 240ms ease-out both;
    }

    .bar-rise {
      animation: bar-rise 520ms var(--ease-out) both;
    }

    :global(.sk-ghost) .bar-rise {
      animation: none;
    }
  }

  .plot {
    cursor: crosshair;
  }

  .chip-btn {
    transition: color 120ms ease-out;
  }

  @media (prefers-reduced-motion: no-preference) {
    .zoom-chip {
      animation: chip-in 200ms var(--ease-out) both;
    }
  }

  @keyframes chip-in {
    from {
      opacity: 0;
      scale: 0.96;
    }
  }

  @keyframes tick-in {
    from {
      opacity: 0;
    }
  }

  @keyframes bar-rise {
    from {
      scale: 1 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-held {
      scale: none;
    }
  }
</style>
