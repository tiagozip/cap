<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div
  bind:this={ref}
  data-slot="field-label"
  class={cn("flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50", className)}
  {...rest}
>
  {@render children?.()}
</div>
