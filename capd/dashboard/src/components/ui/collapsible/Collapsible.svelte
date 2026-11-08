<script>
import { Collapsible } from "bits-ui";

let {
  open = $bindable(false),
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Collapsible.Root bind:open bind:ref data-slot="collapsible" {...rest}>
  {@render children?.()}
</Collapsible.Root>
