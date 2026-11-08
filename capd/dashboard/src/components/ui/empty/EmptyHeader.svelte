<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="empty-header" class={cn("flex max-w-sm flex-col items-center", className)} {...rest}>
  {@render children?.()}
</div>
