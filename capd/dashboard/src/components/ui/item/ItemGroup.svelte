<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div
  bind:this={ref}
  role="list"
  data-slot="item-group"
  class={cn("group/item-group flex w-full flex-col gap-4", className)}
  {...rest}
>
  {@render children?.()}
</div>
