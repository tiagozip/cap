<script>
import { compact } from "../../lib/format.js";
import { dtf, t } from "../../lib/i18n.svelte.js";

let { hours, mode = "all" } = $props();

const weekdayFmt = dtf({ weekday: "short" });
const DAYS = $derived(
  Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i, 12))),
  ),
);
const hourFmt = dtf({ hour: "numeric" });
const hourLabel = (h) => hourFmt.format(new Date(2024, 0, 1, h));

let hover = $state(null);

const grid = $derived.by(() => {
  const cells = Array.from({ length: 7 * 24 }, () => ({ n: 0, bad: 0 }));
  for (const r of hours) {
    const d = new Date(r.b);
    const cell = cells[((d.getDay() + 6) % 7) * 24 + d.getHours()];
    cell.n += r.n;
    cell.bad += r.bad;
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

const peak = $derived.by(() => {
  let best = 0;
  grid.forEach((c, i) => {
    if (value(c) > value(grid[best])) best = i;
  });
  return value(grid[best]) ? best : null;
});
</script>

<div
  data-bone="block"
  class="flex flex-col gap-1"
  role="img"
  aria-label={peak != null
    ? t("Events by weekday and hour, busiest on {day} at {hour}", {
        day: DAYS[Math.floor(peak / 24)],
        hour: hourLabel(peak % 24),
      })
    : t("Events by weekday and hour")}
>
  {#each DAYS as day, d (day)}
    <div class="grid grid-cols-[2.25rem_1fr] items-center gap-2">
      <span class="text-[11px] text-muted-foreground">{day}</span>
      <div class="grid grid-cols-24 gap-[3px]" onpointerleave={() => (hover = null)}>
        {#each { length: 24 } as _, h (h)}
          {@const c = grid[d * 24 + h]}
          <span
            class="aspect-square min-h-2.5 rounded-[3px] {hover === d * 24 + h ? 'outline outline-1 outline-foreground/60' : ''}"
            style:background={fill(c)}
            onpointerenter={() => (hover = d * 24 + h)}
          ></span>
        {/each}
      </div>
    </div>
  {/each}
  <div class="grid grid-cols-[2.25rem_1fr] gap-2">
    <span></span>
    <div class="relative h-4 text-[11px] text-muted-foreground" aria-hidden="true">
      {#each [0, 6, 12, 18] as h (h)}
        <span class="absolute" style:left="{(h / 24) * 100}%">{hourLabel(h)}</span>
      {/each}
    </div>
  </div>
</div>

<p class="mt-3 min-h-5 border-t border-border pt-3 text-sm text-muted-foreground" role="status">
  {#if hover != null}
    {@const c = grid[hover]}
    {t("{day}, {from} to {to}:", {
      day: DAYS[Math.floor(hover / 24)],
      from: hourLabel(hover % 24),
      to: hourLabel((hover % 24 + 1) % 24),
    })}
    <span class="font-medium text-foreground tabular-nums">{compact(c.n)}</span> {t("events")}{t(", ")}
    <span class="font-medium text-foreground tabular-nums">{compact(c.bad)}</span> {t("flagged or blocked")}
  {:else if peak != null}
    {mode === "bad"
      ? t("Most flagged and blocked traffic on {day} around {hour}, in your time zone", {
          day: DAYS[Math.floor(peak / 24)],
          hour: hourLabel(peak % 24),
        })
      : t("Busiest on {day} around {hour}, in your time zone", {
          day: DAYS[Math.floor(peak / 24)],
          hour: hourLabel(peak % 24),
        })}
  {:else}
    {t("Nothing in this period.")}
  {/if}
</p>
