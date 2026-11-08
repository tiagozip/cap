<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<ul bind:this={ref} data-slot="sidebar-menu" data-sidebar="menu" class={cn("flex w-full min-w-0 flex-col gap-0", className)} {...rest}>
  {@render children?.()}
</ul>
