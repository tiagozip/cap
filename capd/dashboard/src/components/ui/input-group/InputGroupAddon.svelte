<script>
import { getContext, setContext, untrack } from "svelte";
import { tv } from "tailwind-variants";

let {
  class: className,
  align = "inline-start",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const group = getContext("input-group");
const parts = $state({ buttons: 0 });
setContext("input-group-addon", parts);

$effect(() => {
  const key = align;
  if (!group) return;
  untrack(() => {
    group[key] = (group[key] ?? 0) + 1;
  });
  return () => {
    group[key] -= 1;
  };
});

const addon = tv({
  base: "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  variants: {
    align: {
      "inline-start": "order-first ps-2 data-button:ms-[-0.3rem]",
      "inline-end": "order-last pe-2 data-button:me-[-0.3rem]",
      "block-start":
        "order-first w-full justify-start px-2.5 pt-2 [.border-b]:pb-2",
      "block-end":
        "order-last w-full justify-start px-2.5 pb-2 [.border-t]:pt-2",
    },
  },
});
</script>

<div
  bind:this={ref}
  role="group"
  data-slot="input-group-addon"
  data-align={align}
  data-button={parts.buttons > 0 || undefined}
  class={addon({ align, class: className })}
  onclick={(e) => {
    if (e.target.closest("button")) return;
    e.currentTarget.parentElement?.querySelector("input")?.focus();
  }}
  {...rest}
>
  {@render children?.()}
</div>
