<script>
import { DropdownMenu } from "bits-ui";
import { getContext, setContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import "../../../polish/overlays/motion.css";
import { glide } from "../../../polish/overlays/glide.js";
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

let pad = $state(null);
$effect(() => {
  if (ref && pad) return glide(ref, pad);
});
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
      "relative z-50 max-h-(--bits-floating-available-height) w-(--bits-floating-anchor-width) overflow-x-hidden overflow-y-auto bg-popover text-popover-foreground outline-none data-ending-style:overflow-hidden",
      menuSizes[resolved].panel,
      className,
    )}
    {...rest}
  >
    <span bind:this={pad} data-slot="menu-glide" aria-hidden="true"></span>
    {@render children?.()}
  </DropdownMenu.Content>
</DropdownMenu.Portal>
