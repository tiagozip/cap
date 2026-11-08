<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { menuSizes, sizeKey } from "./sizes.js";

let { class: className, ref = $bindable(null), ...rest } = $props();

const size = getContext(sizeKey);
</script>

<DropdownMenu.Separator
  bind:ref
  data-slot="dropdown-menu-separator"
  class={cn("h-px bg-border", menuSizes[size?.() ?? "default"].separator, className)}
  {...rest}
/>
