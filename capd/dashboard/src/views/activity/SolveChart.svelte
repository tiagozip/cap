<script>
import { latency } from "../../lib/format.js";
import { t } from "../../lib/i18n.svelte.js";
import Bars from "./Bars.svelte";

let { solve } = $props();

const PER_DOUBLING = 4;
const TICKS = [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000];

let hover = $state(null);

const ms = (r) => r.b * solve.size + solve.size / 2;
const step = (v) =>
  Math.floor(PER_DOUBLING * Math.log2(Math.max(solve.size, v) / solve.size));
const edge = (k) => solve.size * 2 ** (k / PER_DOUBLING);

const span = $derived.by(() => {
  if (!solve.rows.length) return { lo: 0, hi: 1 };
  const ks = solve.rows.map((r) => step(ms(r)));
  return { lo: Math.min(...ks), hi: Math.max(...ks) + 1 };
});

const bins = $derived.by(() => {
  const out = Array.from({ length: span.hi - span.lo }, (_, i) => ({
    from: edge(span.lo + i),
    to: edge(span.lo + i + 1),
    pass: 0,
    flagged: 0,
    blocked: 0,
  }));
  for (const r of solve.rows) {
    const bin = out[step(ms(r)) - span.lo];
    if (!bin) continue;
    if (r.outcome === "block") bin.blocked += r.n;
    else {
      bin.flagged += r.flagged;
      bin.pass += r.n - r.flagged;
    }
  }
  return out;
});

const ticks = $derived(
  TICKS.filter((v) => v >= edge(span.lo) && v <= edge(span.hi)).map((v) => ({
    x:
      (PER_DOUBLING * Math.log2(v / solve.size) - span.lo) /
      (span.hi - span.lo),
    label: latency(v),
  })),
);

const stats = $derived.by(() => {
  const sorted = [...solve.rows].sort((a, b) => a.b - b.b);
  const total = sorted.reduce((a, r) => a + r.n, 0);
  if (!total) return null;
  const quantile = (q) => {
    let seen = 0;
    for (const r of sorted) {
      seen += r.n;
      if (seen >= total * q) return ms(r);
    }
    return ms(sorted.at(-1));
  };
  const p10 = quantile(0.1);
  let fast = 0;
  let bad = 0;
  for (const r of sorted) {
    if (ms(r) > p10) break;
    fast += r.n;
    bad += r.flagged + (r.outcome === "block" ? r.n : 0);
  }
  const share = (n, d) => Math.round((n / d) * 100);
  return {
    median: quantile(0.5),
    p10,
    fastBad: share(bad, fast),
    allBad: share(
      sorted.reduce(
        (a, r) => a + r.flagged + (r.outcome === "block" ? r.n : 0),
        0,
      ),
      total,
    ),
  };
});
</script>

<Bars
  {bins}
  bind:hover
  label={t("Solves by how long the proof of work took")}
  title={(b) => t("{from} to {to}", { from: latency(b.from), to: latency(b.to) })}
  {ticks}
/>

<div class="mt-4 border-t border-border pt-4">
  <p class="max-w-md text-sm text-pretty text-muted-foreground">
    {#if !stats}
      {t("No solves in this period.")}
    {:else}
      {t("Half of all solves finish in")} <span class="font-medium text-foreground tabular-nums">{latency(stats.median)}</span>{t(".")}
      {t("The fastest tenth take under")} <span class="font-medium text-foreground tabular-nums">{latency(stats.p10)}</span>{t(", and")}
      <span class="font-medium tabular-nums {stats.fastBad > stats.allBad * 1.5 ? 'text-warning' : 'text-foreground'}">{stats.fastBad}%</span>
      {t("of those were flagged or blocked, against {allBad}% overall.", { allBad: stats.allBad })}
    {/if}
  </p>
</div>
