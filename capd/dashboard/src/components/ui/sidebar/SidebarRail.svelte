<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
import { useSidebar } from "./context.svelte.js";

let { class: className, ...rest } = $props();

const sidebar = useSidebar();
</script>

<button
  type="button"
  data-sidebar="rail"
  data-slot="sidebar-rail"
  aria-label={t("Toggle sidebar")}
  tabindex="-1"
  onclick={() => sidebar.toggle()}
  title={t("Toggle sidebar")}
  class={cn(
    "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
    "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
    "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
    "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:start-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
    "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
    "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
    className,
  )}
  {...rest}
></button>
