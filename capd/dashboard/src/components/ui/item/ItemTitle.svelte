<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div bind:this={ref} data-slot="item-title" class={cn("line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4", className)} {...rest}>
  {@render children?.()}
</div>
