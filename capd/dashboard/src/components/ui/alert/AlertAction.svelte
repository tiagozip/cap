<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="alert-action" class={cn("absolute end-2 top-2", className)} {...rest}>
  {@render children?.()}
</div>
