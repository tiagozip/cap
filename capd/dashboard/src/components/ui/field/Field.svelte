<script>
import { fieldVariants } from "./variants.js";

let {
  class: className,
  orientation = "vertical",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<div
  bind:this={ref}
  role="group"
  data-slot="field"
  data-orientation={orientation}
  class={fieldVariants({ orientation, class: className })}
  {...rest}
>
  {@render children?.()}
</div>
