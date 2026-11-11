<script>
import { Dialog } from "bits-ui";
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  showCloseButton = false,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<div bind:this={ref} data-slot="dialog-footer" class={cn("mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...rest}>
  {@render children?.()}
  {#if showCloseButton}
    <Dialog.Close
      class="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-foreground/5 px-3 text-sm text-foreground hover:bg-foreground/10"
    >
      {t("Close")}
    </Dialog.Close>
  {/if}
</div>
