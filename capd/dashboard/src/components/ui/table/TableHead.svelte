<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<th bind:this={ref} data-slot="table-head" class={cn("h-9 px-4 text-start align-middle font-normal whitespace-nowrap text-foreground not-last:border-e", className)} {...rest}>
  {@render children?.()}
</th>
