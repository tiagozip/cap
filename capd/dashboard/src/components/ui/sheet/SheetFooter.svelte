<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="sheet-footer" class={cn("mt-auto flex flex-col gap-2 p-4", className)} {...rest}>
  {@render children?.()}
</div>
