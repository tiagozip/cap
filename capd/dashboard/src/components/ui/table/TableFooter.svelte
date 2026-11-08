<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<tfoot bind:this={ref} data-slot="table-footer" class={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...rest}>
  {@render children?.()}
</tfoot>
