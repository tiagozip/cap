<script>
import { Dialog } from "bits-ui";
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
import SheetContent from "../sheet/SheetContent.svelte";
import { useSidebar } from "./context.svelte.js";

let {
  side = "start",
  variant = "sidebar",
  collapsible = "offcanvas",
  label,
  class: className,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const sidebar = useSidebar();
const rtl =
  typeof document !== "undefined" && document.documentElement.dir === "rtl";
const physicalSide = $derived(
  side === "start"
    ? rtl
      ? "right"
      : "left"
    : side === "end"
      ? rtl
        ? "left"
        : "right"
      : side,
);
const boxed = $derived(variant === "floating" || variant === "inset");

$effect(() => {
  if (variant !== "inset" || collapsible === "none" || sidebar.isMobile) return;
  sidebar.inset = true;
  return () => {
    sidebar.inset = false;
  };
});
</script>

{#if collapsible === "none"}
  <div
    bind:this={ref}
    data-slot="sidebar"
    class={cn("flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground", className)}
    {...rest}
  >
    {@render children?.()}
  </div>
{:else if sidebar.isMobile}
  <Dialog.Root bind:open={() => sidebar.openMobile, (value) => (sidebar.openMobile = value)}>
    <SheetContent
      data-sidebar="sidebar"
      data-slot="sidebar"
      data-mobile="true"
      aria-label={label ?? t("Sidebar")}
      class="rounded-[calc(var(--radius)+8px)] bg-sidebar p-0 text-sidebar-foreground data-[side=left]:w-(--sidebar-width) data-[side=right]:w-(--sidebar-width)"
      style="--sidebar-width: 18rem;"
      side={physicalSide}
      showCloseButton={false}
    >
      <div class="flex h-full w-full flex-col p-2">{@render children?.()}</div>
    </SheetContent>
  </Dialog.Root>
{:else}
  <div
    class="group peer hidden text-sidebar-foreground md:block"
    data-state={sidebar.state}
    data-collapsible={sidebar.state === "collapsed" ? collapsible : ""}
    data-variant={variant}
    data-side={physicalSide}
    data-slot="sidebar"
  >
    <div
      data-slot="sidebar-gap"
      class={cn(
        "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear motion-reduce:transition-none",
        "group-data-[collapsible=offcanvas]:w-0",
        "group-data-[side=right]:rotate-180",
        boxed
          ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
          : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
      )}
    ></div>
    <aside
      bind:this={ref}
      aria-label={label ?? t("Sidebar")}
      data-slot="sidebar-container"
      data-side={physicalSide}
      inert={sidebar.state === "collapsed" && collapsible === "offcanvas"}
      class={cn(
        "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear motion-reduce:transition-none data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex",
        boxed
          ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
          : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
        className,
      )}
      {...rest}
    >
      <div
        data-sidebar="sidebar"
        data-slot="sidebar-inner"
        class="flex size-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:shadow-sm group-data-[variant=floating]:ring-1 group-data-[variant=floating]:ring-sidebar-border"
      >
        {@render children?.()}
      </div>
    </aside>
  </div>
{/if}
