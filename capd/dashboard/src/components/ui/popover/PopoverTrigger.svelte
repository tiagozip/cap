<script>
import { Popover } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Popover.Trigger bind:ref data-slot="popover-trigger" {...rest}>
  {@render children?.()}
</Popover.Trigger>
