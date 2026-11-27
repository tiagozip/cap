<script>
import { compact } from "../../lib/format.js";

let { hours, mode = "all", onpick } = $props();

const DAYS = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
    new Date(Date.UTC(2024, 0, 1 + i, 12)),
  ),
);
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const hourLabel = (h) => hourFmt.format(new Date(2024, 0, 1, h));

let hover = $state(null);
const uid = $props.id();

const grid = $derived.by(() => {
  const cells = Array.from({ length: 7 * 24 }, () => ({
    n: 0,
    bad: 0,
    last: 0,
    weeks: 0,
  }));
  for (const r of hours) {
    const d = new Date(r.b);
    const cell = cells[((d.getDay() + 6) % 7) * 24 + d.getHours()];
    cell.n += r.n;
    cell.bad += r.bad;
    cell.weeks += 1;
    cell.last = Math.max(cell.last, r.b);
  }
  return cells;
});

const value = (c) => (mode === "bad" ? c.bad : c.n);
const max = $derived(Math.max(1, ...grid.map(value)));
const color = $derived(
  mode === "bad" ? "var(--destructive)" : "var(--chart-2)",
);
const fill = (c) => {
  const v = value(c);
  if (!v) return "var(--muted)";
  return `color-mix(in oklab, ${color} ${Math.round(12 + (v / max) * 88)}%, var(--muted))`;
};

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const pick = (i) => {
  const c = grid[i];
  if (!onpick || !c?.last) return;
  onpick([`window:${c.last}-${c.last + 3_600_000}`]);
};

const peak = $derived.by(() => {
  let best = 0;
  grid.forEach((c, i) => {
    if (value(c) > value(grid[best])) best = i;
  });
  return value(grid[best]) ? best : null;
});

const byHour = $derived(
  Array.from({ length: 24 }, (_, h) =>
    grid.reduce((a, c, i) => a + (i % 24 === h ? value(c) : 0), 0),
  ),
);
const hourMax = $derived(Math.max(1, ...byHour));
const byDay = $derived(
  DAYS.map((_, d) =>
    grid.slice(d * 24, d * 24 + 24).reduce((a, c) => a + value(c), 0),
  ),
);
const active = $derived(grid.filter((c) => value(c)).length);
const mean = $derived(
  active ? grid.reduce((a, c) => a + value(c), 0) / active : 0,
);

const day = $derived(hover == null ? null : Math.floor(hover / 24));
const hour = $derived(hover == null ? null : hover % 24);

const versus = (v) => {
  if (!mean || !v) return "";
  const r = v / mean;
  if (r >= 0.9 && r <= 1.1) return "about a typical hour";
  return r > 1
    ? `${r >= 10 ? Math.round(r) : r.toFixed(1)}× a typical hour`
    : `${Math.round(r * 100)}% of a typical hour`;
};

function onkeydown(e) {
  const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 24, ArrowUp: -24 }[
    e.key
  ];
  if (move) {
    e.preventDefault();
    if (hover == null) {
      hover = peak ?? 0;
      return;
    }
    const h = hover % 24;
    if (Math.abs(move) === 1) hover = hover - h + ((h + move + 24) % 24);
    else hover = (hover + move + 168) % 168;
  } else if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    hover = (day ?? 0) * 24 + (e.key === "Home" ? 0 : 23);
  } else if (e.key === "Enter" && hover != null) {
    e.preventDefault();
    pick(hover);
  } else if (e.key === "Escape") hover = null;
}
</script>

<div
  data-bone="block"
  class="heat -m-1 flex flex-col gap-1 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
  role="grid"
  tabindex="0"
  aria-activedescendant={hover == null ? undefined : `${uid}-${hover}`}
  aria-label="Events by weekday and hour{peak != null ? `, busiest on ${DAYS[Math.floor(peak / 24)]} at ${hourLabel(peak % 24)}` : ''}. Use the arrow keys to read each hour{onpick ? ' and Enter to see its events' : ''}."
  {onkeydown}
  onclick={(e) => e.target.closest?.("[role=gridcell]") && hover != null && pick(hover)}
  onfocusout={(e) => !e.currentTarget.contains(e.relatedTarget) && (hover = null)}
  onpointerleave={() => (hover = null)}
>
  <div class="grid grid-cols-[2.25rem_1fr_2.5rem] items-end gap-2" aria-hidden="true">
    <span></span>
    <div class="grid h-8 grid-cols-24 items-end gap-[2px] sm:gap-[3px]">
      {#each byHour as v, h (h)}
        <span
          class="col rounded-[2px]"
          style:height="{Math.max(v ? 6 : 0, (v / hourMax) * 100)}%"
          style:background={hour === h ? color : `color-mix(in oklab, ${color} 35%, var(--muted))`}
          style:--delay="{h * 14}ms"
        ></span>
      {/each}
    </div>
    <span></span>
  </div>
  {#each DAYS as label, d (label)}
    <div class="grid grid-cols-[2.25rem_1fr_2.5rem] items-center gap-2" role="row">
      <span role="rowheader" class="text-[11px] transition-[color] duration-150 {day === d ? 'text-foreground' : 'text-muted-foreground'}">{label}</span>
      <div class="grid grid-cols-24 gap-[2px] sm:gap-[3px]">
        {#each { length: 24 } as _, h (h)}
          {@const c = grid[d * 24 + h]}
          <span
            id="{uid}-{d * 24 + h}"
            role="gridcell"
            tabindex="-1"
            aria-label="{hourLabel(h)}, {c.n} events, {c.bad} flagged or blocked"
            class="cell h-3.5 rounded-[2px] sm:aspect-square sm:h-auto sm:rounded-[3px] {onpick && c.last ? 'cursor-pointer' : ''} {hover === d * 24 + h ? 'outline outline-1 outline-offset-1 outline-foreground/70' : ''}"
            style:background={fill(c)}
            style:--delay="{h * 14 + d * 10}ms"
            onpointerenter={() => (hover = d * 24 + h)}
          ></span>
        {/each}
      </div>
      <span class="text-right text-[11px] tabular-nums transition-[color] duration-150 {day === d ? 'text-foreground' : 'text-muted-foreground'}" aria-hidden="true">{byDay[d] ? compact(byDay[d]) : ""}</span>
    </div>
  {/each}
  <div class="grid grid-cols-[2.25rem_1fr_2.5rem] gap-2">
    <span></span>
    <div class="relative h-4 text-[11px] text-muted-foreground" aria-hidden="true">
      {#each [0, 6, 12, 18] as h (h)}
        <span class="absolute" style:left="{(h / 24) * 100}%">{hourLabel(h)}</span>
      {/each}
    </div>
    <span></span>
  </div>
</div>

<p class="mt-3 min-h-5 border-t border-border pt-3 text-sm text-pretty text-muted-foreground" role="status">
  {#if hover != null}
    {@const c = grid[hover]}
    <span class="text-foreground">{c.weeks === 1 ? dateFmt.format(c.last) : DAYS[day]}, {hourLabel(hour)} to {hourLabel((hour + 1) % 24)}{c.weeks > 1 ? `, over ${c.weeks} weeks` : ""}</span>:
    <span class="font-medium text-foreground tabular-nums">{compact(c.n)}</span> events,
    <span class="font-medium text-foreground tabular-nums">{compact(c.bad)}</span> flagged or blocked{#if c.n && c.bad}{" "}({c.bad / c.n < 0.01 ? "<1" : Math.round((c.bad / c.n) * 100)}%){/if}{#if versus(value(c))}, {versus(value(c))}{/if}
  {:else if peak != null}
    {mode === "bad" ? "Most flagged and blocked traffic" : "Busiest"} on {DAYS[Math.floor(peak / 24)]} around {hourLabel(peak % 24)}, in your time zone
  {:else}
    Nothing in this period.
  {/if}
</p>

<style>
  @media (prefers-reduced-motion: no-preference) {
    .cell {
      transition: background-color 260ms var(--ease-out);
      animation: cell-in 420ms var(--ease-out) var(--delay) backwards;
    }

    .col {
      transform-origin: bottom;
      transition-property: background-color, height;
      transition-duration: 150ms, 320ms;
      animation: col-in 520ms var(--ease-out) var(--delay) backwards;
    }
  }

  :global(.enter) .cell,
  :global(.enter) .col {
    animation: none;
  }

  @keyframes col-in {
    from {
      transform: scaleY(0);
    }
  }

  @keyframes cell-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
</style>
