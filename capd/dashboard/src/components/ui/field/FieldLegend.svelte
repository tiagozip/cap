<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  variant = "legend",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<legend
  bind:this={ref}
  data-slot="field-legend"
  data-variant={variant}
  class={cn("mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base", className)}
  {...rest}
>
  {@render children?.()}
</legend>
