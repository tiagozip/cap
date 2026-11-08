<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { menuSizes, sizeKey } from "./sizes.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const size = getContext(sizeKey);
</script>

<span
  bind:this={ref}
  data-slot="dropdown-menu-shortcut"
  class={cn("ms-auto tracking-widest text-muted-foreground rtl:tracking-normal", menuSizes[size?.() ?? "default"].shortcut, className)}
  {...rest}
>
  {@render children?.()}
</span>
