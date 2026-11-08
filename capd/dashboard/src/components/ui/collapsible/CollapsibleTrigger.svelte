<script>
import { Collapsible } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Collapsible.Trigger bind:ref data-slot="collapsible-trigger" {...rest}>
  {@render children?.()}
</Collapsible.Trigger>
