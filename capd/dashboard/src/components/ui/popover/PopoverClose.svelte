<script>
import { Popover } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Popover.Close bind:ref data-slot="popover-close" {...rest}>
  {@render children?.()}
</Popover.Close>
