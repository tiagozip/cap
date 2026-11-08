<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Description bind:ref data-slot="sheet-description" class={cn("text-sm text-muted-foreground", className)} {...rest}>
  {@render children?.()}
</Dialog.Description>
