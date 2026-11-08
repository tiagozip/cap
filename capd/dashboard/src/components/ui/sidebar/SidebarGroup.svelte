<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sidebar-group" data-sidebar="group" class={cn("relative flex w-full min-w-0 flex-col p-2", className)} {...rest}>
  {@render children?.()}
</div>
