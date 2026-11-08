<script>
import { tv } from "tailwind-variants";
import Tooltip from "../tooltip/Tooltip.svelte";
import TooltipContent from "../tooltip/TooltipContent.svelte";
import TooltipTrigger from "../tooltip/TooltipTrigger.svelte";
import { useSidebar } from "./context.svelte.js";

let {
  class: className,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  href,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const sidebar = useSidebar();
const rtl =
  typeof document !== "undefined" && document.documentElement.dir === "rtl";
const menuButton = tv({
  base: "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding,box-shadow] group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
  variants: {
    variant: {
      default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      outline:
        "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
    },
    size: {
      default: "h-8 text-sm",
      sm: "h-7 text-xs",
      lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
    },
  },
});
const showTip = $derived(
  !!tooltip && sidebar.state === "collapsed" && !sidebar.isMobile,
);
</script>

{#snippet element(extra)}
  <svelte:element
    this={href ? "a" : "button"}
    bind:this={ref}
    {href}
    type={href ? undefined : "button"}
    data-slot="sidebar-menu-button"
    data-sidebar="menu-button"
    data-size={size}
    data-active={isActive || undefined}
    aria-current={href && isActive ? "page" : undefined}
    class={menuButton({ variant, size, class: className })}
    {...extra}
    {...rest}
  >
    {@render children?.()}
  </svelte:element>
{/snippet}

{#if showTip}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        {@render element(props)}
      {/snippet}
    </TooltipTrigger>
    <TooltipContent side={rtl ? "left" : "right"} align="center">{tooltip}</TooltipContent>
  </Tooltip>
{:else}
  {@render element({})}
{/if}
