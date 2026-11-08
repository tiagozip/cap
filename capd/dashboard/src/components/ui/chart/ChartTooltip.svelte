<script>
import { cn } from "../../../lib/utils.js";

let {
  tip,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  valueFormatter,
  labelFormatter,
} = $props();

let box = $state(null);
let width = $state(0);
let height = $state(0);

const nest = $derived(tip.items.length === 1 && indicator !== "dot");
const title = $derived(
  hideLabel
    ? ""
    : labelFormatter
      ? labelFormatter(tip.title, tip.items)
      : tip.title,
);
const left = $derived.by(() => {
  const right = tip.x + 12;
  if (right + width <= tip.width) return right;
  return Math.max(0, tip.x - 12 - width);
});
const top = $derived(
  Math.min(Math.max(0, tip.y - height / 2), Math.max(0, tip.height - height)),
);
const format = (item) => {
  if (valueFormatter) return valueFormatter(item.value, item);
  const value =
    typeof item.value === "object" && item.value !== null
      ? (item.parsed?.y ?? item.parsed)
      : item.value;
  return typeof value === "number"
    ? value.toLocaleString()
    : String(value ?? "");
};
</script>

<div
  bind:this={box}
  bind:clientWidth={width}
  bind:clientHeight={height}
  data-slot="chart-tooltip-content"
  data-visible={tip.visible || undefined}
  aria-hidden="true"
  class="chart-tip pointer-events-none absolute top-0 left-0 z-10 grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-popover/80 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-xl backdrop-blur-md"
  style:transform={`translate(${left}px, ${top}px)`}
  style:opacity={tip.visible ? 1 : 0}
>
  {#if !nest && title}
    <div class="font-medium">{title}</div>
  {/if}
  <div class="grid gap-1.5">
    {#each tip.items as item, index (index)}
      <div class={cn("flex w-full flex-wrap items-stretch gap-2", indicator === "dot" && "items-center")}>
        {#if !hideIndicator}
          <div
            class={cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
              "h-2.5 w-2.5": indicator === "dot",
              "w-1": indicator === "line",
              "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
              "my-0.5": nest && indicator === "dashed",
            })}
            style:--color-bg={item.color}
            style:--color-border={indicator === "dot" ? item.color : item.border}
          ></div>
        {/if}
        <div class={cn("flex flex-1 justify-between gap-4 leading-none", nest ? "items-end" : "items-center")}>
          <div class="grid gap-1.5">
            {#if nest && title}
              <div class="font-medium">{title}</div>
            {/if}
            <span class="text-muted-foreground">{item.label}</span>
          </div>
          <span class="font-mono font-medium text-foreground tabular-nums">{format(item)}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .chart-tip {
    transition: opacity 150ms ease-out;
  }
  @media (prefers-reduced-motion: no-preference) {
    .chart-tip[data-visible] {
      transition:
        opacity 150ms ease-out,
        transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
    }
  }
</style>
