<script>
import { Dialog } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Trigger bind:ref data-slot="drawer-trigger" {...rest}>
  {@render children?.()}
</Dialog.Trigger>
