<script>
import { cn } from "../../../lib/utils.js";
import Badge from "../badge/Badge.svelte";

let {
  items,
  value = $bindable([]),
  onChange,
  label,
  class: className,
  ...rest
} = $props();

const gap = 8;
const inset = 16;
const shape =
  "absolute top-0 left-0 h-8 border border-[color-mix(in_srgb,var(--foreground)_22%,var(--stack-base))]";

let group = $state(null);
let widths = $state(null);
let jump = $state(false);
let pressed = $state(null);
const rtl = $derived(
  group ? getComputedStyle(group).direction === "rtl" : false,
);

const selected = $derived(new Set(value));
const chosen = $derived(items.map((item) => selected.has(item.value)));
const joined = $derived(
  chosen.map((on, index) => on && index > 0 && chosen[index - 1]),
);
const gaps = $derived(
  joined.map((join, index) => (index === 0 || join ? 0 : gap)),
);
const offsets = $derived.by(() => {
  const out = [];
  let total = 0;
  for (const [index, width] of (widths ?? []).entries()) {
    total += gaps[index] ?? 0;
    out.push(total);
    total += width;
  }
  return { out, total };
});
const place = (start, width) => (rtl ? offsets.total - start - width : start);

let signature = "";
$effect(() => {
  const next = chosen.map(Number).join("");
  if (next !== signature) {
    signature = next;
    jump = false;
  }
});

$effect(() => {
  if (!group) return;
  items.length;
  const buttons = [...group.querySelectorAll(":scope > button")];
  const read = () => {
    const next = buttons.map((button) =>
      Number.parseFloat(getComputedStyle(button).width),
    );
    if (
      widths?.length === next.length &&
      widths.every((width, index) => Math.abs(width - next[index]) < 0.01)
    )
      return;
    jump = widths !== null;
    widths = next;
  };
  read();
  const observer = new ResizeObserver(read);
  for (const button of buttons) observer.observe(button);
  return () => observer.disconnect();
});

const toggle = (target) => {
  const next = items
    .map((item) => item.value)
    .filter((item) =>
      item === target ? !selected.has(item) : selected.has(item),
    );
  value = next;
  onChange?.(next);
};
const release = (index) => {
  if (pressed === index) pressed = null;
};
const motion = $derived(jump ? "none" : null);
</script>

<div
  data-slot="filter-chips"
  class={cn("-m-1 min-w-0 [scrollbar-width:none] overflow-x-auto p-1 [&::-webkit-scrollbar]:hidden", className)}
>
  <div bind:this={group} role="group" aria-label={label} class="relative flex w-max items-center" {...rest}>
    {#if widths?.length === items.length}
      <div
        aria-hidden="true"
        class="chip-layer pointer-events-none absolute inset-0 mix-blend-multiply [--stack-base:white] dark:mix-blend-screen dark:[--stack-base:black]"
      >
        {#each items as item, index (`track-${item.value}`)}
          {@const on = joined[index] === true}
          {@const start = index > 0 ? offsets.out[index - 1] + inset : offsets.out[index]}
          {@const width = offsets.out[index] + widths[index] - start}
          {@const origin = place(offsets.out[index], widths[index]) - place(start, width) + widths[index] / 2}
          <span
            class={cn(shape, "chip-shape rounded-e-full border-s-0 bg-[color-mix(in_srgb,var(--foreground)_4%,var(--stack-base))]")}
            data-on={on || undefined}
            style:transform-origin={`${origin}px 50%`}
            style:transform={`translateX(${place(start, width)}px)`}
            style:width={`${width}px`}
            style:opacity={on ? 1 : 0}
            style:scale={pressed === index ? 0.96 : 1}
            style:transition={motion}
          ></span>
        {/each}
        {#each items as item, index (`pill-${item.value}`)}
          {@const on = chosen[index] === true && joined[index] !== true}
          <span
            class={cn(shape, "chip-shape rounded-full bg-[color-mix(in_srgb,var(--foreground)_8%,var(--stack-base))]")}
            data-on={on || undefined}
            style:transform={`translateX(${place(offsets.out[index], widths[index])}px)`}
            style:width={`${widths[index]}px`}
            style:opacity={on ? 1 : 0}
            style:scale={pressed === index ? 0.96 : 1}
            style:transition={motion}
          ></span>
        {/each}
      </div>
    {/if}
    {#each items as item, index (item.value)}
      {@const on = chosen[index] === true}
      <button
        type="button"
        data-slot="filter-chips-item"
        aria-pressed={on}
        onclick={() => toggle(item.value)}
        onpointerdown={() => (pressed = index)}
        onpointerup={() => release(index)}
        onpointerleave={() => release(index)}
        onpointercancel={() => release(index)}
        onkeydown={(event) => {
          if (event.key === " " || event.key === "Enter") pressed = index;
        }}
        onkeyup={() => release(index)}
        onblur={() => release(index)}
        style:margin-inline-start={`${gaps[index]}px`}
        class={cn(
          "chip-button relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-3 text-sm whitespace-nowrap outline-none select-none before:pointer-events-none before:absolute before:-inset-px before:rounded-full before:border",
          item.count !== undefined && "pe-1.25",
          "transition-[color,box-shadow,margin] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] before:transition-[border-color,scale] before:duration-150 before:ease-[cubic-bezier(0.23,1,0.32,1)] active:before:scale-[0.96] motion-reduce:transition-[color,box-shadow] motion-reduce:before:transition-[border-color] motion-reduce:active:before:scale-100",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50",
          on
            ? "text-foreground before:border-transparent"
            : "text-muted-foreground before:border-border hover:text-foreground hover:before:border-foreground/20",
        )}
      >
        {#if typeof item.label === "function"}{@render item.label()}{:else}{item.label}{/if}
        {#if item.count !== undefined}
          <Badge variant="neutral" size="sm" class="min-w-5">{item.count}</Badge>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .chip-shape {
    transition:
      transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
      width 180ms cubic-bezier(0.23, 1, 0.32, 1),
      scale 150ms cubic-bezier(0.23, 1, 0.32, 1),
      opacity 150ms linear;
  }
  .chip-shape[data-on] {
    transition:
      transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
      width 180ms cubic-bezier(0.23, 1, 0.32, 1),
      scale 150ms cubic-bezier(0.23, 1, 0.32, 1),
      opacity 120ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .chip-shape,
    .chip-shape[data-on] {
      transition: opacity 120ms linear;
      scale: 1 !important;
    }
  }
</style>
