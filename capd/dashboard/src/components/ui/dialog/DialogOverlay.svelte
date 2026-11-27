<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import "../../../polish/overlays/motion.css";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Dialog.Overlay bind:ref data-slot="dialog-overlay" class={cn("fixed inset-0 isolate z-[90] bg-black/25 backdrop-blur-[2px] dark:bg-black/40", className)} {...rest}>
  {@render children?.()}
</Dialog.Overlay>
