<script>
import { Dialog } from "bits-ui";

let { open = $bindable(false), children, ...rest } = $props();
</script>

<Dialog.Root bind:open {...rest}>
  {@render children?.()}
</Dialog.Root>
