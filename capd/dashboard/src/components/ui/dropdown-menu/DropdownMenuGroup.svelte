<script>
import { DropdownMenu } from "bits-ui";

let { ref = $bindable(null), children, ...rest } = $props();
</script>

<DropdownMenu.Group bind:ref data-slot="dropdown-menu-group" {...rest}>
  {@render children?.()}
</DropdownMenu.Group>
