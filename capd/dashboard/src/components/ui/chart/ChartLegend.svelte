<script>
import { cn } from "../../../lib/utils.js";

let { items, verticalAlign = "bottom", class: className, ...rest } = $props();
</script>

<div
  data-slot="chart-legend"
  class={cn("flex flex-wrap items-center justify-center gap-4 text-xs", verticalAlign === "top" ? "pb-3" : "pt-3", className)}
  {...rest}
>
  {#each items as item (item.label)}
    <div class="flex items-center gap-1.5">
      <div class="h-2 w-2 shrink-0 rounded-[2px]" style:background-color={item.color}></div>
      {item.label}
    </div>
  {/each}
</div>
