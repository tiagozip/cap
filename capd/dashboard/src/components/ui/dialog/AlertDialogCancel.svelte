<script>
import { Dialog } from "bits-ui";
import { buttonVariants } from "../button/variants.js";

let {
  class: className,
  variant = "outline",
  size = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Dialog.Close
  bind:ref
  data-slot="alert-dialog-cancel"
  data-variant={variant}
  class={buttonVariants({ variant, size, class: className })}
  {...rest}
>
  {@render children?.()}
</Dialog.Close>
