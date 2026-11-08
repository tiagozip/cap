<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  inset,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const size = getContext(sizeKey);
const s = $derived(menuSizes[size?.() ?? "default"]);
</script>

<div
  bind:this={ref}
  data-slot="dropdown-menu-label"
  data-inset={inset || undefined}
  class={cn("font-medium text-muted-foreground", s.label, s.inset, className)}
  {...rest}
>
  {@render children?.()}
</div>
