<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="card-footer" class={cn("flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)", className)} {...rest}>
  {@render children?.()}
</div>
