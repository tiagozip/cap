<script>
import { Dialog } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import "../../../polish/overlays/motion.css";
import { swipe } from "../../../polish/overlays/swipe.js";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  side = "end",
  showCloseButton = true,
  overlayClass,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const rtl = $derived(
  typeof document !== "undefined" && document.documentElement.dir === "rtl",
);
const physicalSide = $derived(
  side === "start"
    ? rtl
      ? "right"
      : "left"
    : side === "end"
      ? rtl
        ? "left"
        : "right"
      : side,
);

$effect(() => {
  if (ref) return swipe(ref, physicalSide);
});
</script>

<Dialog.Portal {...portalProps}>
  <Dialog.Overlay
    data-slot="sheet-overlay"
    class={cn(
      "fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] dark:bg-black/40",
      overlayClass,
    )}
  />
  <Dialog.Content
    bind:ref
    data-slot="sheet-content"
    data-side={physicalSide}
    class={cn(
      "fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-popover bg-clip-padding text-sm text-popover-foreground outline-none",
      "data-[side=bottom]:inset-x-3 data-[side=bottom]:bottom-3 data-[side=bottom]:h-auto",
      "data-[side=top]:inset-x-3 data-[side=top]:top-3 data-[side=top]:h-auto",
      "data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:w-[440px] data-[side=left]:max-w-[calc(100%-1.5rem)]",
      "data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:w-[440px] data-[side=right]:max-w-[calc(100%-1.5rem)]",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if showCloseButton}
      <Dialog.Close
        data-slot="sheet-close"
        class="absolute end-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground/5 text-muted-foreground outline-none active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 transition-[background-color,color,scale] duration-150 ease-out hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
      >
        <Icon name="x" class="size-4" stroke={1.8} />
        <span class="sr-only">Close</span>
      </Dialog.Close>
    {/if}
  </Dialog.Content>
</Dialog.Portal>
