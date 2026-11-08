<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="empty-title" class={cn("text-base font-semibold tracking-tight", className)} {...rest}>
  {@render children?.()}
</div>
