<script>
import { compact } from "../../lib/format.js";
import { countryName, flagUrl } from "../../lib/geo.js";

let { code, countries, hint = "" } = $props();

const pct = (v) => (v > 0 && v < 0.01 ? "<1%" : `${Math.round(v * 100)}%`);

const stats = $derived.by(() => {
  const cur = countries?.current ?? [];
  const total = cur.reduce((a, r) => a + r.n, 0) || 1;
  const prev = Object.fromEntries(
    (countries?.previous ?? []).map((r) => [r.value, r.n]),
  );
  const rows = {};
  [...cur]
    .sort((a, b) => b.n - a.n)
    .forEach((r, i) => {
      rows[r.value] = { ...r, rank: i + 1, share: r.n / total };
    });
  return {
    rows,
    prev,
    count: cur.length,
    hasPrev: !!countries?.previous?.length,
  };
});

const card = $derived.by(() => {
  const r = stats.rows[code];
  const before = stats.prev[code];
  if (!r) return { empty: true, before };
  const flagged = r.n ? (r.flagged ?? 0) / r.n : 0;
  const blocked = r.n ? (r.blocked ?? 0) / r.n : 0;
  let change = null;
  if (before) {
    const d = (r.n - before) / before;
    change = {
      up: d >= 0,
      text:
        Math.abs(d) < 0.005
          ? "Same as the previous period"
          : `${d >= 0 ? "Up" : "Down"} ${pct(Math.abs(d))} from the previous period`,
    };
  } else if (stats.hasPrev) change = { up: true, text: "New this period" };
  return {
    ...r,
    flagged,
    blocked,
    clean: Math.max(0, 1 - flagged - blocked),
    change,
  };
});
</script>

<div class="flex items-center gap-1.5">
  {#if flagUrl(code)}<img src={flagUrl(code)} alt="" class="h-3.5 w-[18px] shrink-0 rounded-[2px] object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" width="18" height="14" />{/if}
  <span class="truncate font-medium">{countryName(code)}</span>
  {#if card.rank}<span class="ms-auto text-muted-foreground tabular-nums">#{card.rank} of {stats.count}</span>{/if}
</div>
{#if card.empty}
  <p class="mt-1.5 text-muted-foreground">{card.before ? `No events now, ${compact(card.before)} in the previous period` : "No events in this period"}</p>
{:else}
  <div class="mt-2 flex items-baseline gap-1">
    <span class="text-base leading-none font-medium tabular-nums">{compact(card.n)}</span>
    <span class="text-muted-foreground">events</span>
    <span class="ms-auto text-muted-foreground tabular-nums">{pct(card.share)} of all</span>
  </div>
  <div class="mt-2 flex h-1.5 gap-px overflow-hidden rounded-full bg-muted">
    {#if card.clean}<span class="h-full bg-foreground/25" style:flex-grow={card.clean}></span>{/if}
    {#if card.flagged}<span class="h-full min-w-0.5 bg-warning" style:flex-grow={card.flagged}></span>{/if}
    {#if card.blocked}<span class="h-full min-w-0.5 bg-destructive" style:flex-grow={card.blocked}></span>{/if}
  </div>
  <div class="mt-1.5 flex gap-3 text-muted-foreground tabular-nums">
    <span class="flex items-center gap-1"><span class="size-1.5 rounded-full bg-warning"></span>{pct(card.flagged)} flagged</span>
    <span class="flex items-center gap-1"><span class="size-1.5 rounded-full bg-destructive"></span>{pct(card.blocked)} blocked</span>
  </div>
  {#if card.change}
    <p class="mt-2 border-t border-border/60 pt-2 {card.change.up ? 'text-info' : 'text-warning'}">{card.change.text}</p>
  {/if}
{/if}
{#if hint}<p class="mt-2 text-muted-foreground">{hint}</p>{/if}
