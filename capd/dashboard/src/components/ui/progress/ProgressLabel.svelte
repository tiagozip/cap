<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<span bind:this={ref} data-slot="progress-label" class={cn("text-sm font-medium", className)} {...rest}>
  {@render children?.()}
</span>
