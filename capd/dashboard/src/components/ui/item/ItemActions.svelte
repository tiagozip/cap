<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="item-actions" class={cn("flex items-center gap-2", className)} {...rest}>
  {@render children?.()}
</div>
