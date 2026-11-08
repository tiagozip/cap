<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<p
  bind:this={ref}
  data-slot="field-description"
  class={cn(
    "text-start text-sm leading-normal font-normal text-muted-foreground [[data-variant=legend]+&]:-mt-1.5",
    "last:mt-0 nth-last-2:-mt-1",
    "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</p>
