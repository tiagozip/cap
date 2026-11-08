<script>
import { Tooltip } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Tooltip.Trigger bind:ref data-slot="tooltip-trigger" {...rest}>
  {@render children?.()}
</Tooltip.Trigger>
