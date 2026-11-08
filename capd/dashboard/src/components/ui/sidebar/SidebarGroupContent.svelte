<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sidebar-group-content" data-sidebar="group-content" class={cn("w-full text-sm", className)} {...rest}>
  {@render children?.()}
</div>
