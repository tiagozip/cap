<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<span
  bind:this={ref}
  class={cn("flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4", className)}
  {...rest}
>
  {@render children?.()}
</span>
