<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<fieldset
  bind:this={ref}
  data-slot="field-set"
  class={cn("flex flex-col gap-4", className)}
  {...rest}
>
  {@render children?.()}
</fieldset>
