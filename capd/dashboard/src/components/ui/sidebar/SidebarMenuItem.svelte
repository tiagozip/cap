<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<li bind:this={ref} data-slot="sidebar-menu-item" data-sidebar="menu-item" class={cn("group/menu-item relative", className)} {...rest}>
  {@render children?.()}
</li>
