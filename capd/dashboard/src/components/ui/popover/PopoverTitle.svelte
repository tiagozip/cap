<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<h2 bind:this={ref} data-slot="popover-title" class={cn("text-base font-medium", className)} {...rest}>
  {@render children?.()}
</h2>
