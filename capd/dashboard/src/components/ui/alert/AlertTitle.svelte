<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="alert-title" class={cn("col-start-2 font-bold [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground", className)} {...rest}>
  {@render children?.()}
</div>
