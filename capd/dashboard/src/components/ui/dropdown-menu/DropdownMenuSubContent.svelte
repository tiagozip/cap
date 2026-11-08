<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  align = "start",
  alignOffset = -5,
  side,
  sideOffset = 1,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const size = getContext(sizeKey);
const resolved = $derived(size?.() ?? "default");
const rtl =
  typeof document !== "undefined" && document.documentElement.dir === "rtl";
</script>

<DropdownMenu.SubContent
  bind:ref
  {align}
  {alignOffset}
  side={side ?? (rtl ? "left" : "right")}
  {sideOffset}
  data-slot="dropdown-menu-sub-content"
  data-size={resolved}
  class={cn(
    "z-50 max-h-(--bits-floating-available-height) origin-(--bits-floating-transform-origin) overflow-x-hidden overflow-y-auto bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-[state=closed]:animate-out data-[state=closed]:overflow-hidden data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
    menuSizes[resolved].panel,
    "w-auto min-w-44 shadow-lg",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</DropdownMenu.SubContent>
