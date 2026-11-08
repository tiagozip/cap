<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Dialog.Portal {...portalProps}>
  <Dialog.Overlay
    data-slot="drawer-overlay"
    class="fixed inset-0 z-50 bg-black/40 transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
  />
  <Dialog.Content
    bind:ref
    data-slot="drawer-content"
    class={cn(
      "fixed inset-x-0 bottom-0 z-50 mt-6 flex h-[calc(100%-1.5rem)] flex-col rounded-t-[10px] border-t border-border bg-popover text-popover-foreground outline-none transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:translate-y-full data-ending-style:duration-300 data-starting-style:translate-y-full motion-reduce:transition-none",
      className,
    )}
    {...rest}
  >
    <div class="pt-3 pb-2">
      <div data-slot="drawer-handle" aria-hidden="true" class="mx-auto h-1.5 w-14 shrink-0 rounded-full bg-foreground/20"></div>
    </div>
    {@render children?.()}
  </Dialog.Content>
</Dialog.Portal>
