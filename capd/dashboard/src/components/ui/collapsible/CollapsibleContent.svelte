<script>
import { Collapsible } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<Collapsible.Content bind:ref data-slot="collapsible-content" {...rest}>
  {@render children?.()}
</Collapsible.Content>
