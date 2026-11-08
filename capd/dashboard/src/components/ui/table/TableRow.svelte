<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<tr
  bind:this={ref}
  data-slot="table-row"
  class={cn("border-b hover:bg-muted/50 [&:has([aria-expanded=true])]:bg-muted/50 data-[state=selected]:bg-muted", className)}
  {...rest}
>
  {@render children?.()}
</tr>
