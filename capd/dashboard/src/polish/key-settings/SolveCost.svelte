<script>
import { Row } from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { latency } from "../../lib/format.js";

let { siteKey, form, baseline } = $props();

const BINS = 28;
let solve = $state(null);

$effect(() => {
  let live = true;
  api("GET", `/keys/${siteKey}/analytics/insights?range=7d`).then((res) => {
    if (live) solve = res?.solve?.rows ? res.solve : { size: 1, rows: [] };
  });
  return () => {
    live = false;
  };
});

const stats = $derived.by(() => {
  if (!solve) return null;
  const ms = (r) => r.b * solve.size + solve.size / 2;
  const rows = solve.rows
    .filter((r) => r.outcome !== "block" && r.n > 0)
    .map((r) => ({ ms: ms(r), n: r.n }))
    .sort((a, b) => a.ms - b.ms);
  const total = rows.reduce((a, r) => a + r.n, 0);
  if (!total) return { total: 0 };
  const quantile = (q) => {
    let seen = 0;
    for (const r of rows) {
      seen += r.n;
      if (seen >= total * q) return r.ms;
    }
    return rows.at(-1).ms;
  };
  const lo = Math.log(Math.max(1, quantile(0.01)));
  const hi = Math.log(Math.max(2, quantile(0.99)));
  const span = Math.max(hi - lo, 0.01);
  const at = (v) =>
    Math.min(
      BINS - 1,
      Math.max(0, Math.floor(((Math.log(v) - lo) / span) * BINS)),
    );
  const bins = Array(BINS).fill(0);
  for (const r of rows) bins[at(r.ms)] += r.n;
  const peak = Math.max(...bins);
  const median = quantile(0.5);
  return {
    total,
    median,
    p90: quantile(0.9),
    bins: bins.map((n) => n / peak),
    mid: at(median),
  };
});

const factor = $derived.by(() => {
  if (form.protocol !== "sha256-pow" || baseline.protocol !== "sha256-pow")
    return 1;
  const d1 = Number(form.difficulty);
  const d0 = Number(baseline.difficulty);
  const c1 = Number(form.challengeCount);
  const c0 = Number(baseline.challengeCount);
  if (![d1, d0, c1, c0].every((v) => Number.isFinite(v) && v > 0)) return 1;
  return 16 ** (d1 - d0) * (c1 / c0);
});
</script>

<Row label="Solve time" help="Real visitors over the past 7 days.">
  <div class="flex min-h-14 w-full max-w-72 flex-col justify-center gap-2">
    {#if stats?.total}
      <div class="flex h-7 items-end gap-px" aria-hidden="true">
        {#each stats.bins as v, i}
          <span
            class="flex-1 rounded-t-[1.5px] {i === stats.mid ? 'bg-foreground' : 'bg-muted-foreground/35'}"
            style="height: {Math.max(v * 100, v ? 8 : 3)}%"
          ></span>
        {/each}
      </div>
      <p class="text-sm text-muted-foreground tabular-nums">
        Half finish within <span class="font-medium text-foreground">{latency(stats.median)}</span>, 90% within {latency(stats.p90)}.
      </p>
      {#if factor !== 1}
        <p class="text-sm tabular-nums {factor >= 4 ? 'text-warning' : 'text-muted-foreground'}" role="status">
          About {latency(stats.median * factor)} after you save.
        </p>
      {/if}
    {:else if stats}
      <p class="text-sm text-muted-foreground">No solves in the past 7 days.</p>
    {/if}
  </div>
</Row>
