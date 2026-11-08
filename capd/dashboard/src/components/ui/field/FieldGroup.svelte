<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div
  bind:this={ref}
  data-slot="field-group"
  class={cn(
    "group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</div>
