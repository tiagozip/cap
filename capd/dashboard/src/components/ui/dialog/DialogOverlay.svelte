<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Overlay bind:ref data-slot="dialog-overlay" class={cn("fixed inset-0 isolate z-[90] bg-gradient-to-b from-black/20 to-black/25 backdrop-blur-[2px] duration-250 ease-out data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0", className)} {...rest}>
  {@render children?.()}
</Dialog.Overlay>
