<script>
import { Dialog } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Close bind:ref data-slot="dialog-close" {...rest}>
  {@render children?.()}
</Dialog.Close>
