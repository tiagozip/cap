<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Select.Portal {...portalProps}>
  <Select.Content
    bind:ref
    {side}
    {sideOffset}
    {align}
    {alignOffset}
    data-slot="select-content"
    data-align-trigger="false"
    class={cn(
      "relative isolate z-50 max-h-(--bits-floating-available-height) w-(--bits-floating-anchor-width) min-w-36 origin-(--bits-floating-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-200 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[align-trigger=true]:zoom-in-100 data-[align-trigger=true]:zoom-out-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...rest}
  >
    <Select.ScrollUpButton
      data-slot="select-scroll-up-button"
      class="top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4"
    >
      <Icon name="chevron-up" />
    </Select.ScrollUpButton>
    <Select.Viewport>
      {@render children?.()}
    </Select.Viewport>
    <Select.ScrollDownButton
      data-slot="select-scroll-down-button"
      class="bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4"
    >
      <Icon name="chevron-down" />
    </Select.ScrollDownButton>
  </Select.Content>
</Select.Portal>
