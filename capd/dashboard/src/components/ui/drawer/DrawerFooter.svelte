<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="drawer-footer" class={cn("mt-auto flex shrink-0 flex-col gap-2 p-4", className)} {...rest}>
  {@render children?.()}
</div>
