<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<p bind:this={ref} data-slot="item-description" class={cn("line-clamp-2 text-start text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary", className)} {...rest}>
  {@render children?.()}
</p>
