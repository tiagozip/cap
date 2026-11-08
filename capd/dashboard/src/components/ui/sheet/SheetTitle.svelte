<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Title bind:ref data-slot="sheet-title" class={cn("text-base font-semibold text-foreground", className)} {...rest}>
  {@render children?.()}
</Dialog.Title>
