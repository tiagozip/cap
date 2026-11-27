<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import "../../../polish/overlays/motion.css";
import { glide } from "../../../polish/overlays/glide.js";
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

let pad = $state(null);
$effect(() => {
  if (ref && pad) return glide(ref, pad);
});
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
    "relative z-50 max-h-(--bits-floating-available-height) overflow-x-hidden overflow-y-auto bg-popover text-popover-foreground outline-none data-ending-style:overflow-hidden",
    menuSizes[resolved].panel,
    "w-auto min-w-44",
    className,
  )}
  {...rest}
>
  <span bind:this={pad} data-slot="menu-glide" aria-hidden="true"></span>
  {@render children?.()}
</DropdownMenu.SubContent>
