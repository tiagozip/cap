<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<td bind:this={ref} data-slot="table-cell" class={cn("h-10 px-4 align-middle whitespace-nowrap tabular-nums not-last:border-e", className)} {...rest}>
  {@render children?.()}
</td>
