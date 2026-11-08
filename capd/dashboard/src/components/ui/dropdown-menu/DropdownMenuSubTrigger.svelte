<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";
import { itemBase, menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  inset,
  highlighted,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const size = getContext(sizeKey);
const s = $derived(menuSizes[size?.() ?? "default"]);
</script>

<DropdownMenu.SubTrigger
  bind:ref
  data-slot="dropdown-menu-sub-trigger"
  data-inset={inset || undefined}
  class={cn(
    itemBase,
    s.row,
    s.inset,
    s.icon,
    "not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground",
    highlighted === undefined
      ? "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
      : highlighted && "bg-accent text-accent-foreground",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon name="chevron-right" class="ms-auto rtl:-scale-x-100" />
</DropdownMenu.SubTrigger>
