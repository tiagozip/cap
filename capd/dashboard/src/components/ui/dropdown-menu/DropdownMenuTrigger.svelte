<script>
import { DropdownMenu } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<DropdownMenu.Trigger bind:ref data-slot="dropdown-menu-trigger" class={cn("select-none", className)} {...rest}>
  {@render children?.()}
</DropdownMenu.Trigger>
