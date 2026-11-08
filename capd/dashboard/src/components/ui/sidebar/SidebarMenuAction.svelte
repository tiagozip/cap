<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  showOnHover = false,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<button
  bind:this={ref}
  type="button"
  data-slot="sidebar-menu-action"
  data-sidebar="menu-action"
  class={cn(
    "absolute end-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-[transform,box-shadow] group-data-[collapsible=icon]:hidden peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 peer-data-[size=sm]/menu-button:top-1 after:absolute after:-inset-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 md:after:hidden [&>svg]:size-4 [&>svg]:shrink-0",
    showOnHover &&
      "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-active/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</button>
