<script>
import { DropdownMenu } from "bits-ui";
import { getContext, setContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 6,
  size,
  portalProps,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const inherited = getContext(sizeKey);
const resolved = $derived(size ?? inherited?.() ?? "default");
setContext(sizeKey, () => resolved);
</script>

<DropdownMenu.Portal {...portalProps}>
  <DropdownMenu.Content
    bind:ref
    {align}
    {alignOffset}
    {side}
    {sideOffset}
    data-slot="dropdown-menu-content"
    data-size={resolved}
    class={cn(
      "z-50 max-h-(--bits-floating-available-height) w-(--bits-floating-anchor-width) origin-(--bits-floating-transform-origin) overflow-x-hidden overflow-y-auto bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none data-[state=closed]:animate-out data-[state=closed]:overflow-hidden data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      menuSizes[resolved].panel,
      className,
    )}
    {...rest}
  >
    {@render children?.()}
  </DropdownMenu.Content>
</DropdownMenu.Portal>
