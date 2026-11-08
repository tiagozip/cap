<script>
import { Popover } from "bits-ui";

let { open = $bindable(false), children, ...rest } = $props();
</script>

<Popover.Root bind:open {...rest}>
  {@render children?.()}
</Popover.Root>
