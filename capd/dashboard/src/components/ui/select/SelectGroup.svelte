<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Select.Group bind:ref data-slot="select-group" class={cn("scroll-my-1 p-1", className)} {...rest}>
  {@render children?.()}
</Select.Group>
