<script>
import { latency } from "../../lib/format.js";
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

const at = (v) =>
  (PER_DOUBLING * Math.log2(Math.max(solve.size, v) / solve.size) - span.lo) /
  (span.hi - span.lo);

const ticks = $derived(
  TICKS.filter((v) => v >= edge(span.lo) && v <= edge(span.hi)).map((v) => ({
    x:
      (PER_DOUBLING * Math.log2(v / solve.size) - span.lo) /
      (span.hi - span.lo),
    label: latency(v).replace(/\.0s$/, "s"),
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

{#snippet marks()}
  {#if stats}
    {@const x = Math.min(1, Math.max(0, at(stats.median)))}
    <div data-bone="ignore" class="pointer-events-none absolute inset-y-0 z-10 border-s border-dashed border-foreground/35" style:left="{x * 100}%">
      <span class="absolute -top-4 rounded-[4px] px-1 text-[11px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums {x > 0.75 ? 'end-1' : 'start-1'}">Median {latency(stats.median)}</span>
    </div>
  {/if}
{/snippet}

<Bars
  {bins}
  {marks}
  bind:hover
  label="Solves by how long the proof of work took"
  title={(b) => `${latency(b.from)} to ${latency(b.to)}`}
  {ticks}
  empty="No solves in this period"
/>

{#if stats}
  <div class="mt-4 border-t border-border pt-4">
    <p class="max-w-md text-sm text-pretty text-muted-foreground">
      Half of all solves finish in <span class="font-medium text-foreground tabular-nums">{latency(stats.median)}</span>.
      The fastest tenth take under <span class="font-medium text-foreground tabular-nums">{latency(stats.p10)}</span>, and
      <span class="font-medium tabular-nums {stats.fastBad > stats.allBad * 1.5 ? 'text-warning' : 'text-foreground'}">{stats.fastBad}%</span>
      of those were flagged or blocked, against {stats.allBad}% overall.
    </p>
  </div>
{/if}
