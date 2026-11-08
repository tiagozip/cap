<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sidebar-content" data-sidebar="content" class={cn("flex min-h-0 flex-1 scrollbar-none flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden", className)} {...rest}>
  {@render children?.()}
</div>
