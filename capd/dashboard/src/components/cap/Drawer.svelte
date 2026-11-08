<script>
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/index.js";

let {
  open = $bindable(false),
  title,
  description,
  lead,
  titleClass = "",
  stacked = false,
  onclose,
  actions,
  children,
} = $props();
</script>

<Sheet
  bind:open
  onOpenChange={(v) => {
    if (!v) onclose?.();
  }}
>
  <SheetContent
    class="data-[side=right]:w-[34rem] {stacked ? 'z-[94]' : ''}"
    overlayClass={stacked ? "z-[94]" : ""}
  >
    <SheetHeader class="flex-row items-center gap-3 border-b border-border px-5 pe-14">
      {#if lead}{@render lead()}{/if}
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <SheetTitle class="truncate {titleClass}">{title}</SheetTitle>
        {#if description}<SheetDescription class="truncate">{description}</SheetDescription>{/if}
      </div>
      {#if actions}<div class="flex shrink-0 items-center gap-1">{@render actions()}</div>{/if}
    </SheetHeader>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">{@render children()}</div>
  </SheetContent>
</Sheet>
