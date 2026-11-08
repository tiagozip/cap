<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<p bind:this={ref} data-slot="popover-description" class={cn("text-muted-foreground", className)} {...rest}>
  {@render children?.()}
</p>
