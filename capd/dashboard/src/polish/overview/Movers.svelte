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

const GLYPH = {
  flags: "flag",
  agents: "bot",
  reasons: "ban",
  networks: "server",
  browsers: "globe",
  devices: "monitor",
  origins: "link",
  languages: "globe",
  countries: "globe",
  os: "monitor",
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
  <ul class="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
    {#each movers as m (`${m.tab.id}:${m.r.value}`)}
      {@const up = m.cur > m.was}
      {@const risky = m.tab.id === "flags" || m.tab.id === "agents" || m.tab.id === "reasons"}
      {@const tone = up && risky ? "danger" : up ? "up" : "down"}
      {@const now = tone === "danger" ? "stroke-destructive" : up ? "stroke-(--chart-1)" : "stroke-muted-foreground"}
      {@const ratio = m.was ? Math.abs(m.cur - m.was) / m.was : 10}
      {@const moved = Math.min(100, Math.max(4, up ? (Math.log10(1 + ratio) / Math.log10(11)) * 100 : ratio * 100))}
      <li class="min-w-0 border-b border-border/60 last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
        <button
          type="button"
          class="mover grid w-full cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1.25rem_minmax(0,1fr)_auto_1.75rem] [@media(hover:hover)]:hover:bg-nav-hover"
          title="Show events where {m.tab.column.toLowerCase()} is {m.tab.name(m.r)}"
          onclick={() => onpick([`${m.tab.field}:${m.r.value}`])}
        >
          <span class="flex size-5 items-center justify-center text-muted-foreground">
            {#if m.tab.icon}{@render m.tab.icon(m.r)}{:else}<Icon name={GLYPH[m.tab.id] ?? "activity"} size={15} />{/if}
          </span>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="truncate leading-5">{m.tab.name(m.r)}</span>
            <span class="truncate text-xs leading-4 text-muted-foreground">{KIND[m.tab.id] ?? m.tab.column}</span>
          </span>
          <span class="flex min-w-[6.5rem] flex-col items-end gap-0.5">
            <span class="inline-flex items-center gap-1 leading-5 font-medium tabular-nums">
              {compact(m.cur)}
              <span class="inline-flex items-center gap-0.5 text-xs font-normal {tone === 'danger' ? 'text-destructive' : 'text-muted-foreground'}">
                {#if m.was && m.cur}
                  <Icon name={up ? "trendUp" : "trendDown"} size={12} stroke={2.25} />
                  <span class="sr-only">{up ? "Up" : "Down"}</span>
                {/if}
                {change(m)}
              </span>
            </span>
            <span class="text-xs leading-4 text-muted-foreground tabular-nums">{m.was ? `from ${compact(m.was)}` : "None before"}</span>
          </span>
          <svg class="size-7 -rotate-90 max-sm:hidden {up ? '' : '-scale-y-100'}" viewBox="0 0 28 28" aria-hidden="true">
            <circle cx="14" cy="14" r="11" fill="none" stroke-width="3" class="stroke-muted" />
            <circle cx="14" cy="14" r="11" fill="none" stroke-width="3" stroke-linecap="round" pathLength="100" stroke-dasharray="{moved} 100" class={now} />
          </svg>
        </button>
      </li>
    {/each}
  </ul>
{/if}
