<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<span bind:this={ref} data-slot="progress-value" class={cn("ms-auto text-sm text-muted-foreground tabular-nums", className)} {...rest}>
  {@render children?.()}
</span>
