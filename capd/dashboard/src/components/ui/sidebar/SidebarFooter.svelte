<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sidebar-footer" data-sidebar="footer" class={cn("flex flex-col gap-2 p-2", className)} {...rest}>
  {@render children?.()}
</div>
