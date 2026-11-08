<script>
import { Popover } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import FloatingArrow from "./FloatingArrow.svelte";

let {
  class: className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 8,
  arrow = true,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Popover.Portal {...portalProps}>
  <Popover.Content
    bind:ref
    {align}
    {alignOffset}
    {side}
    {sideOffset}
    arrowPadding={14}
    data-slot="popover-content"
    class={cn(
      "popover-panel z-50 flex w-72 origin-(--bits-floating-transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
      className,
    )}
    {...rest}
  >
    {#if arrow}
      <FloatingArrow component={Popover.Arrow} data-slot="popover-arrow" class="popover-arrow" />
    {/if}
    {@render children?.()}
  </Popover.Content>
</Popover.Portal>
