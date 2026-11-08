<script>
import { DropdownMenu } from "bits-ui";

let { open = $bindable(false), children, ...rest } = $props();
</script>

<DropdownMenu.Sub bind:open {...rest}>
  {@render children?.()}
</DropdownMenu.Sub>
