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
  children,
} = $props();

let edited = $state(false);
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
    edited = false;
    dismissed = true;
  }}
  onOpenChangeComplete={(v) => {
    if (v || !dismissed) return;
    dismissed = false;
    onclose?.();
  }}
>
  <DialogContent
    class="flex max-h-[calc(100dvh-2rem)] flex-col {widths[size]}"
    interactOutsideBehavior={edited ? "ignore" : "close"}
    oninput={() => (edited = true)}
    onchange={() => (edited = true)}
  >
    <DialogHeader class="pe-8">
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
      <DialogFooter>{@render footer()}</DialogFooter>
    {/if}
  </DialogContent>
</Dialog>
