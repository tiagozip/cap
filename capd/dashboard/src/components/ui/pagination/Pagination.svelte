<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  label = "Pagination",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<nav bind:this={ref} aria-label={label} data-slot="pagination" class={cn("mx-auto flex w-full justify-center", className)} {...rest}>
  {@render children?.()}
</nav>
