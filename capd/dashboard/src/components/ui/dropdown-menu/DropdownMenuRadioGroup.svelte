<script>
import { DropdownMenu } from "bits-ui";

let {
  value = $bindable(""),
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<DropdownMenu.RadioGroup bind:ref bind:value data-slot="dropdown-menu-radio-group" {...rest}>
  {@render children?.()}
</DropdownMenu.RadioGroup>
