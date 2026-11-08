<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<label bind:this={ref} data-slot="label" class={cn("flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-aria-disabled:cursor-not-allowed peer-aria-disabled:opacity-50", className)} {...rest}>
  {@render children?.()}
</label>
