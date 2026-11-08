<script>
import { RadioGroup } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  value = $bindable(""),
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<RadioGroup.Root bind:ref bind:value data-slot="radio-group" class={cn("grid w-full gap-2", className)} {...rest}>
  {@render children?.()}
</RadioGroup.Root>
