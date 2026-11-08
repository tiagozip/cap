<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="popover-header" class={cn("flex flex-col gap-0.5 text-sm", className)} {...rest}>
  {@render children?.()}
</div>
