<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  orientation = "horizontal",
  decorative = true,
  ref = $bindable(null),
  ...rest
} = $props();
</script>

<div
  bind:this={ref}
  data-slot="separator"
  data-orientation={orientation}
  role={decorative ? "none" : "separator"}
  aria-orientation={decorative ? undefined : orientation}
  class={cn(
    "shrink-0 bg-foreground/15 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
    className,
  )}
  {...rest}
></div>
