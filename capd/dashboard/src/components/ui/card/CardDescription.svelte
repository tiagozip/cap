<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="card-description" class={cn("text-sm text-muted-foreground", className)} {...rest}>
  {@render children?.()}
</div>
