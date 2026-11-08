<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<thead bind:this={ref} data-slot="table-header" class={cn("bg-muted [&_tr]:border-b [&_tr]:hover:bg-transparent", className)} {...rest}>
  {@render children?.()}
</thead>
