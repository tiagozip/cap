<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="item-footer" class={cn("flex basis-full items-center justify-between gap-2", className)} {...rest}>
  {@render children?.()}
</div>
