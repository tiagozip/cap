<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { itemBase, menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  inset,
  variant = "default",
  highlighted,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const size = getContext(sizeKey);
const s = $derived(menuSizes[size?.() ?? "default"]);
</script>

<DropdownMenu.Item
  bind:ref
  data-slot="dropdown-menu-item"
  data-inset={inset || undefined}
  data-variant={variant}
  class={cn(
    itemBase,
    s.row,
    s.inset,
    s.icon,
    "group/dropdown-menu-item relative not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[variant=destructive]:text-destructive data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive dark:data-[variant=destructive]:data-highlighted:bg-destructive/20 data-[variant=destructive]:*:[svg]:text-destructive",
    highlighted && "bg-accent text-accent-foreground",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</DropdownMenu.Item>
