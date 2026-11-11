<script>
import { Dialog } from "bits-ui";
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
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
</script>

<Dialog.Portal {...portalProps}>
  <Dialog.Overlay
    data-slot="sheet-overlay"
    class={cn(
      "fixed inset-0 z-50 bg-linear-to-b from-black/20 to-black/25 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
      overlayClass,
    )}
  />
  <Dialog.Content
    bind:ref
    data-slot="sheet-content"
    data-side={physicalSide}
    class={cn(
      "smooth-shadow-ring-xl fixed z-50 flex flex-col overflow-hidden rounded-2xl bg-popover bg-clip-padding text-sm text-popover-foreground transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:opacity-0 motion-reduce:transition-none",
      "data-[side=bottom]:inset-x-3 data-[side=bottom]:bottom-3 data-[side=bottom]:h-auto data-[side=bottom]:data-ending-style:translate-y-4 data-[side=bottom]:data-starting-style:translate-y-4",
      "data-[side=top]:inset-x-3 data-[side=top]:top-3 data-[side=top]:h-auto data-[side=top]:data-ending-style:-translate-y-4 data-[side=top]:data-starting-style:-translate-y-4",
      "data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:w-[440px] data-[side=left]:max-w-[calc(100%-1.5rem)] data-[side=left]:data-ending-style:-translate-x-4 data-[side=left]:data-starting-style:-translate-x-4",
      "data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:w-[440px] data-[side=right]:max-w-[calc(100%-1.5rem)] data-[side=right]:data-ending-style:translate-x-4 data-[side=right]:data-starting-style:translate-x-4",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if showCloseButton}
      <Dialog.Close
        data-slot="sheet-close"
        class="absolute end-4 top-4 inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition-ring outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
      >
        <Icon name="x" class="size-4" stroke={1.8} />
        <span class="sr-only">{t("Close")}</span>
      </Dialog.Close>
    {/if}
  </Dialog.Content>
</Dialog.Portal>
