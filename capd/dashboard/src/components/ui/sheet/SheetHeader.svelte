<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sheet-header" class={cn("flex flex-col gap-1 p-4", className)} {...rest}>
  {@render children?.()}
</div>
