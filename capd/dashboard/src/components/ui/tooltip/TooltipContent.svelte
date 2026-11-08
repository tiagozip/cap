<script>
import { Tooltip } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import FloatingArrow from "../popover/FloatingArrow.svelte";

let {
  class: className,
  side = "top",
  sideOffset = 6,
  align = "center",
  alignOffset = 0,
  arrow = false,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Tooltip.Portal {...portalProps}>
  <Tooltip.Content
    bind:ref
    {side}
    {sideOffset}
    {align}
    {alignOffset}
    data-slot="tooltip-content"
    class={cn(
      "z-[110] inline-flex max-w-xs origin-(--bits-floating-transform-origin) items-center justify-center gap-1.5 rounded-lg bg-foreground px-[var(--tooltip-inset)] py-1.5 text-[0.8125rem] font-medium text-background transition-[transform,opacity] [--tooltip-inset:0.625rem] data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 **:data-[slot=kbd]:h-[1.125rem] **:data-[slot=kbd]:min-w-[1.125rem] **:data-[slot=kbd]:rounded-sm **:data-[slot=kbd]:text-[0.6875rem] **:data-[slot=kbd-group]:gap-0.5 motion-reduce:transition-none dark:bg-popover dark:text-popover-foreground dark:shadow-[0_2px_8px_rgb(0_0_0/0.4)] dark:ring-1 dark:ring-white/15",
      "duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if arrow}
      <FloatingArrow
        component={Tooltip.Arrow}
        data-slot="tooltip-arrow"
        class="absolute size-2 rotate-45 rounded-[1px] bg-foreground data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1 data-[side=top]:-bottom-1 dark:bg-popover"
      />
    {/if}
  </Tooltip.Content>
</Tooltip.Portal>
