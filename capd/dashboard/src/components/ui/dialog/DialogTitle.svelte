<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Title bind:ref data-slot="dialog-title" class={cn("text-lg leading-none font-semibold tracking-tight", className)} {...rest}>
  {@render children?.()}
</Dialog.Title>
