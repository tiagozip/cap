<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<kbd bind:this={ref} data-slot="kbd-group" class={cn("inline-flex items-center gap-1", className)} {...rest}>
  {@render children?.()}
</kbd>
