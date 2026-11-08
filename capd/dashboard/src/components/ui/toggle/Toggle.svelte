<script>
import { Toggle } from "bits-ui";
import { toggleVariants } from "./variants.js";

let {
  class: className,
  variant = "default",
  size = "default",
  pressed = $bindable(false),
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Toggle.Root bind:ref bind:pressed data-slot="toggle" class={toggleVariants({ variant, size, class: className })} {...rest}>
  {@render children?.()}
</Toggle.Root>
