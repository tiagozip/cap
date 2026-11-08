<script>
import { Dialog } from "bits-ui";
import Icon from "../icon/Icon.svelte";
import DialogOverlay from "./DialogOverlay.svelte";
import { dialogContentVariants } from "./variants.js";

let {
  class: className,
  size = "default",
  showCloseButton = true,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Dialog.Portal {...portalProps}>
  <DialogOverlay />
  <Dialog.Content bind:ref data-slot="dialog-content" class={dialogContentVariants({ size, class: className })} {...rest}>
    {@render children?.()}
    {#if showCloseButton}
      <Dialog.Close
        data-slot="dialog-close"
        class="absolute end-5 top-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition-[background-color,color,scale,box-shadow] duration-150 ease-out hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <Icon name="x" class="size-4" />
        <span class="sr-only">Close</span>
      </Dialog.Close>
    {/if}
  </Dialog.Content>
</Dialog.Portal>
