<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="field-content" class={cn("group/field-content flex flex-1 flex-col gap-0.5 leading-snug", className)} {...rest}>
  {@render children?.()}
</div>
