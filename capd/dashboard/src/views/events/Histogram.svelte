<script>
import { compact } from "../../lib/format.js";
import { dtf, numFmt, t } from "../../lib/i18n.svelte.js";

let { series, bucket, onpick, active = null, height = 180 } = $props();

const DAY = 86_400_000;

const SETS = $derived([
  {
    id: "issued",
    label: t("Challenge issued"),
    color: "var(--chart-4)",
    value: (b) => b.challenges,
  },
  {
    id: "solved",
    label: t("Solved"),
    color: "var(--chart-2)",
    value: (b) => Math.max(0, b.solved - b.flagged),
  },
  {
    id: "verified",
    label: t("Verified"),
    color: "var(--chart-1)",
    value: (b) => b.verified,
  },
  {
    id: "flagged",
    label: t("Flagged"),
    color: "var(--warning)",
    value: (b) => b.flagged,
  },
  {
    id: "failed",
    label: t("Failed"),
    color: "var(--faint-foreground)",
    value: (b) => b.failed,
  },
  {
    id: "limited",
    label: t("Rate limited"),
    color: "var(--violet)",
    value: (b) => b.limited,
  },
  {
    id: "blocked",
    label: t("Blocked"),
    color: "var(--destructive)",
    value: (b) => b.blocked,
  },
]);

let hover = $state(null);

const rows = $derived(
  series.map((b) => {
    const parts = SETS.map((s) => s.value(b));
    return { b: b.b, parts, total: parts.reduce((a, v) => a + v, 0) };
  }),
);
const max = $derived(Math.max(1, ...rows.map((r) => r.total)));
const step = $derived.by(() => {
  const raw = max / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
});
const peak = $derived(step * 3);
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

const spanLabel = (b) =>
  bucket >= DAY
    ? dayFmt.format(new Date(b))
    : t("{from} to {to}", {
        from: longFmt.format(new Date(b)),
        to: hourFmt.format(new Date(b + bucket)),
      });

const ticks = $derived.by(() => {
  const n = rows.length;
  if (!n) return [];
  const multiDay = bucket >= DAY || rows.at(-1).b - rows[0].b > DAY;
  return [0, 0.25, 0.5, 0.75]
    .map((f) => Math.floor(f * n))
    .filter((i, j, a) => a.indexOf(i) === j)
    .map((i) => ({
      i,
      text: (multiDay ? dayFmt : hourFmt).format(new Date(rows[i].b)),
    }));
});
</script>

<figure class="flex flex-col gap-3">
  <div class="relative pl-8">
    <div class="pointer-events-none absolute inset-y-0 left-0 right-0" style:height="{height}px" aria-hidden="true">
      {#each [3, 2, 1, 0] as k (k)}
        <div class="absolute inset-x-0 flex items-center" style:top="{((3 - k) / 3) * 100}%">
          <span class="w-8 -translate-y-1/2 pr-2 text-left text-[11px] text-muted-foreground tabular-nums">{compact(step * k)}</span>
          <span data-bone="ignore" class="flex-1 -translate-y-1/2 border-t {k ? 'border-dashed border-border' : 'border-border'}"></span>
        </div>
      {/each}
    </div>
    <div
      data-bone="block"
      class="relative flex items-end"
      style:height="{height}px"
      style:gap="{gap}px"
      role="group"
      aria-label={t("Events over time. Pick a bar to see the events in it.")}
      onpointerleave={() => (hover = null)}
    >
      {#each rows as r, i (r.b)}
        <button
          type="button"
          class="relative flex h-full min-w-0 flex-1 items-end outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default {r.total
            ? 'cursor-pointer'
            : ''}"
          disabled={!r.total}
          aria-label={t("{span}, {count} events. Show them.", { span: spanLabel(r.b), count: numFmt(r.total) })}
          onpointerenter={() => (hover = i)}
          onfocus={() => (hover = i)}
          onblur={() => (hover = null)}
          onclick={() => onpick(r.b, r.b + bucket)}
        >
          <span
            class="flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px] transition-[height,opacity] duration-300 ease-(--ease-out) motion-reduce:transition-none"
            style:height="{r.total ? Math.max(2, (r.total / peak) * 100) : 0}%"
            style:opacity={hover == null || hover === i ? 1 : 0.45}
          >
            {#each SETS as s, j (s.id)}
              {#if r.parts[j]}
                <span class="w-full shrink-0" style:height="{(r.parts[j] / r.total) * 100}%" style:background={s.color}></span>
              {/if}
            {/each}
          </span>
        </button>
      {/each}
    </div>

    {#if hover != null && rows[hover]?.total}
      {@const r = rows[hover]}
      {@const x = ((hover + 0.5) / rows.length) * 100}
      <div
        class="pointer-events-none absolute top-0 z-10 w-56 rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-overlay"
        style:left="calc(2rem + (100% - 2rem) * {x / 100})"
        style:transform="translateX({x < 20 ? '-12px' : x > 80 ? 'calc(-100% + 12px)' : '-50%'})"
      >
        <p class="mb-2 font-medium">{spanLabel(r.b)}</p>
        <ul class="flex flex-col gap-1">
          {#each SETS as s, j (s.id)}
            {#if r.parts[j]}
              <li class="flex items-center gap-2 text-muted-foreground">
                <span class="size-2 shrink-0 rounded-full" style:background={s.color}></span>
                {s.label}
                <span class="ml-auto font-medium text-foreground tabular-nums">{numFmt(r.parts[j])}</span>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}

    <div class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
      {#each ticks as tick (tick.i)}
        <span class="absolute whitespace-nowrap" style:left="{(tick.i / rows.length) * 100}%">{tick.text}</span>
      {/each}
    </div>
  </div>

</figure>
