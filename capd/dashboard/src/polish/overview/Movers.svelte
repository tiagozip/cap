<script>
import Icon from "../../components/Icon.svelte";
import { compact } from "../../lib/format.js";

let { now, before, limit = 60, totals = [0, 0], onpick } = $props();

const SHOWN = 6;
const KIND = {
  flags: "Risk flag",
  agents: "AI agent",
  reasons: "Failure reason",
  countries: "Country",
  networks: "Network",
  browsers: "Browser",
  os: "Operating system",
  devices: "Device",
  origins: "Website",
  languages: "Language",
};

const movers = $derived.by(() => {
  if (!now || !before) return null;
  const [nowTotal, prevTotal] = totals;
  const floor = Math.max(10, (nowTotal + prevTotal) * 0.002);
  const scale = prevTotal ? nowTotal / prevTotal : 1;
  const prevOf = new Map(
    before.map((t) => [
      t.id,
      {
        full: (t.rows?.length ?? 0) >= limit,
        rows: new Map((t.rows ?? []).map((r) => [r.value, r.n])),
      },
    ]),
  );
  const out = [];
  for (const tab of now) {
    const prev = prevOf.get(tab.id);
    if (!prev || !tab.rows) continue;
    const seen = new Set();
    const consider = (r, cur, was) => {
      if (Math.max(cur, was) < floor || cur === was) return;
      const expected = was * scale;
      const score = Math.abs(cur - expected) / Math.sqrt(cur + expected);
      if (score < 3 || Math.abs(cur - was) < 0.05 * Math.max(was, 1)) return;
      out.push({ tab, r, cur, was, score });
    };
    for (const r of tab.rows) {
      seen.add(r.value);
      const was = prev.rows.get(r.value);
      if (was == null && prev.full) continue;
      consider(r, r.n, was ?? 0);
    }
    if ((tab.rows.length ?? 0) < limit)
      for (const [value, was] of prev.rows)
        if (!seen.has(value)) consider({ value, n: 0 }, 0, was);
  }
  return out.sort((a, b) => b.score - a.score).slice(0, SHOWN);
});

const peak = $derived(
  Math.max(1, ...(movers ?? []).map((m) => Math.max(m.cur, m.was))),
);

const change = (m) => {
  if (!m.was) return "New";
  if (!m.cur) return "Gone";
  const pct = Math.round(((m.cur - m.was) / m.was) * 100);
  return `${Math.abs(pct) > 999 ? ">999" : Math.abs(pct)}%`;
};
</script>

{#if movers && !movers.length}
  <p class="m-auto py-8 text-center text-sm text-balance text-muted-foreground">Nothing moved much since the previous period.</p>
{:else if movers}
  <ul class="grid grid-cols-1 gap-x-6 gap-y-0.5 lg:grid-cols-2">
    {#each movers as m (`${m.tab.id}:${m.r.value}`)}
      {@const up = m.cur > m.was}
      {@const risky = m.tab.id === "flags" || m.tab.id === "agents" || m.tab.id === "reasons"}
      <li class="min-w-0">
        <button
          type="button"
          class="group relative flex h-10 w-full cursor-pointer items-center gap-2 sm:gap-3 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:bg-nav-hover"
          title="Show events where {m.tab.column.toLowerCase()} is {m.tab.name(m.r)}"
          onclick={() => onpick([`${m.tab.field}:${m.r.value}`])}
        >
          {#if m.tab.icon}{@render m.tab.icon(m.r)}{/if}
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate leading-5">{m.tab.name(m.r)}</span>
            <span class="truncate text-xs leading-4 text-muted-foreground">{KIND[m.tab.id] ?? m.tab.column}</span>
          </span>
          <span class="relative h-1.5 w-16 shrink-0 rounded-full bg-muted max-sm:hidden" aria-hidden="true">
            <span
              class="absolute inset-y-0 left-0 rounded-full {up && risky ? 'bg-destructive/70' : 'bg-(--chart-1)'}"
              style:width="{(m.cur / peak) * 100}%"
            ></span>
            <span
              class="absolute -inset-y-0.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/70"
              style:left="{(m.was / peak) * 100}%"
            ></span>
          </span>
          <span class="flex w-16 shrink-0 flex-col items-end sm:w-20">
            <span class="font-medium tabular-nums leading-5">{compact(m.cur)}</span>
            {#if m.was}<span class="text-xs leading-4 text-muted-foreground tabular-nums">from {compact(m.was)}</span>{/if}
          </span>
          <span class="inline-flex w-13 shrink-0 items-center justify-end sm:w-14 gap-0.5 text-xs tabular-nums {up && risky ? 'text-destructive' : 'text-muted-foreground'}">
            {#if m.was && m.cur}
              <Icon name={up ? "trendUp" : "trendDown"} size={12} stroke={2.25} />
              <span class="sr-only">{up ? "Up" : "Down"}</span>
            {/if}
            {change(m)}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
