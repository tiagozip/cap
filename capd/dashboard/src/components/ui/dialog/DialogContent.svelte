<script module>
const press = { x: 0, y: 0, t: -1e9 };
let focused = null;
if (typeof addEventListener !== "undefined") {
  addEventListener(
    "pointerdown",
    (e) => {
      press.x = e.clientX;
      press.y = e.clientY;
      press.t = performance.now();
    },
    { capture: true, passive: true },
  );
  addEventListener(
    "focusin",
    (e) => {
      if (!e.target.closest?.("[data-slot=dialog-content]")) focused = e.target;
    },
    { capture: true },
  );
}

const originOf = () => {
  if (performance.now() - press.t < 800) return { ...press };
  const box = focused?.isConnected && focused.getBoundingClientRect();
  return box?.width
    ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    : null;
};
</script>

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
  overlayClass,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

$effect(() => {
  const origin = ref && originOf();
  if (!origin) return;
  const w = ref.offsetWidth;
  const h = ref.offsetHeight;
  const clamp = (v, size) => Math.min(size * 1.5, Math.max(size * -0.5, v));
  ref.style.setProperty(
    "--dialog-origin",
    `${clamp(origin.x - (innerWidth - w) / 2, w)}px ${clamp(origin.y - (innerHeight - h) / 2, h)}px`,
  );
});
</script>

<Dialog.Portal {...portalProps}>
  <DialogOverlay class={overlayClass} />
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
