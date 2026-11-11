<script>
import { compact } from "../../lib/format.js";
import { numFmt, t } from "../../lib/i18n.svelte.js";

let {
  bins,
  ticks = [],
  label,
  title,
  plot = $bindable(),
  hover = $bindable(null),
  overlay,
  onpointermove,
  class: cls = "",
  ...rest
} = $props();

const PARTS = $derived([
  [
    "pass",
    t("Passed"),
    "color-mix(in oklab, var(--foreground) 22%, transparent)",
  ],
  ["flagged", t("Flagged"), "var(--warning)"],
  ["blocked", t("Blocked"), "var(--destructive)"],
]);

const nice = (v) => {
  if (v <= 1) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= v);
};

const totals = $derived(bins.map((b) => b.pass + b.flagged + b.blocked));
const max = $derived(nice(Math.max(1, ...totals)));
const y = (v) => Math.sqrt(v / max) * 100;
const yTicks = $derived(
  [...new Set([0, nice(max / 4), max])].filter((t) => t <= max),
);

const pick = (e) => {
  const rect = plot.getBoundingClientRect();
  const i = Math.floor(((e.clientX - rect.left) / rect.width) * bins.length);
  hover = i >= 0 && i < bins.length ? i : null;
};
</script>

<div class="grid grid-cols-[auto_1fr] gap-x-3">
  <div class="relative h-40 w-7 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each yTicks as tick (tick)}
      <span class="absolute right-0 leading-none" style:bottom="{y(tick)}%" style:transform="translateY(50%)">{compact(tick)}</span>
    {/each}
  </div>

  <div
    bind:this={plot}
    class="relative h-40 touch-none select-none {cls}"
    aria-label={label}
    {...rest}
    onpointermove={(e) => {
      pick(e);
      onpointermove?.(e);
    }}
    onpointerleave={() => (hover = null)}
  >
    {#each yTicks as tick (tick)}
      <div class="pointer-events-none absolute inset-x-0 border-t {tick === 0 ? 'border-border' : 'border-dashed border-border'}" style:bottom="{y(tick)}%"></div>
    {/each}
    <div data-bone="block" class="pointer-events-none absolute inset-0 flex items-end gap-px">
      {#each bins as b, i (i)}
        {@const v = totals[i]}
        <div class="relative flex h-full min-w-0 flex-1 items-end">
          {#if hover === i}<div class="absolute inset-0 rounded-[3px] bg-foreground/[0.04]"></div>{/if}
          <div
            class="relative flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[2px] transition-[height,opacity] duration-300 ease-(--ease-out) motion-reduce:transition-none"
            style:height="{v ? Math.max(1.5, y(v)) : 0}%"
          >
            {#each PARTS as [k, , c] (k)}
              {#if b[k]}<span class="w-full shrink-0" style:height="{(b[k] / v) * 100}%" style:background={c}></span>{/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>

    {@render overlay?.()}

    {#if hover != null && bins[hover]}
      {@const b = bins[hover]}
      {@const right = hover < bins.length / 2}
      <div
        class="pointer-events-none absolute top-1 z-20 w-44 rounded-lg bg-popover p-3 text-xs text-popover-foreground shadow-[0_0_0_1px_var(--border),0_2px_4px_-1px_rgb(0_0_0/0.06),0_8px_24px_-6px_rgb(0_0_0/0.18)]"
        style:left="{((right ? hover + 1 : hover) / bins.length) * 100}%"
        style:transform="translateX({right ? '8px' : 'calc(-100% - 8px)'})"
      >
        <p class="mb-2 font-medium text-muted-foreground">{title(b)}</p>
        <ul class="flex flex-col gap-1.5">
          {#each PARTS as [k, name, c] (k)}
            <li class="flex items-center gap-2">
              <span class="size-2 shrink-0 rounded-full" style:background={c}></span>
              {name}
              <span class="ms-auto tabular-nums">{numFmt(b[k])}</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div></div>
  <div class="relative mt-2 h-4 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
    {#each ticks as tick (tick.x)}
      <span class="absolute whitespace-nowrap" style:left="{tick.x * 100}%" style:transform="translateX({tick.x === 0 ? '0' : tick.x === 1 ? '-100%' : '-50%'})">{tick.label}</span>
    {/each}
  </div>
</div>

<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
  {#each PARTS as [k, name, c] (k)}
    <span class="flex items-center gap-1.5"><span class="size-2 rounded-full" style:background={c}></span>{name}</span>
  {/each}
</div>
