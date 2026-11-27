<script>
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/index.js";

let {
  open = $bindable(true),
  title,
  description,
  size = "sm",
  onclose,
  footer,
  bare = false,
  overlay,
  dim = false,
  guard = false,
  children,
} = $props();

let dismissed = false;

const widths = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};
</script>

<Dialog
  bind:open
  onOpenChange={(v) => {
    if (v) return;
    dismissed = true;
  }}
  onOpenChangeComplete={(v) => {
    if (v || !dismissed) return;
    dismissed = false;
    onclose?.();
  }}
>
  <DialogContent
    class="flex max-h-[calc(100dvh-2rem)] flex-col {widths[size]} {dim ? 'z-[93]' : ''}"
    overlayClass={dim ? "z-[92] bg-black/60 backdrop-blur-[3px] dark:bg-black/75" : undefined}
    interactOutsideBehavior={guard ? "ignore" : "close"}
  >
    <DialogHeader class={bare ? "sr-only" : "pe-8"}>
      <DialogTitle class="text-balance">{title}</DialogTitle>
      {#if description}
        <DialogDescription class="text-pretty">{description}</DialogDescription>
      {/if}
    </DialogHeader>
    {#if children}
      <div class="-mx-7 -my-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-7 py-1">
        {@render children()}
      </div>
    {/if}
    {#if footer}
      <DialogFooter class={bare ? "sm:grid sm:grid-cols-2" : ""}>{@render footer()}</DialogFooter>
    {/if}
    {@render overlay?.()}
  </DialogContent>
</Dialog>
