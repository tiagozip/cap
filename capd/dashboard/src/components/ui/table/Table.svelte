<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  containerClass,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<div data-slot="table-container" class={cn("relative w-full overflow-x-auto rounded-xl border", containerClass)}>
  <table bind:this={ref} data-slot="table" class={cn("w-full caption-bottom text-sm", className)} {...rest}>
    {@render children?.()}
  </table>
</div>
