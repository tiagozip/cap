<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Select.GroupHeading bind:ref data-slot="select-label" class={cn("px-1.5 py-1 text-xs text-muted-foreground", className)} {...rest}>
  {@render children?.()}
</Select.GroupHeading>
