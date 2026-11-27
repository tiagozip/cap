<script>
import Icon from "../../components/Icon.svelte";
import { SidebarMenuButton } from "../../components/ui/index.js";

let { name, hint = false, ...rest } = $props();
</script>

<SidebarMenuButton {...rest} class="sb-switcher h-10 cursor-pointer gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 text-[14px] ring-1 ring-border hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent [&_svg]:transition-[color] [&_svg]:duration-150 data-[state=open]:[&_svg]:text-foreground">
  <Icon name="key" size={18} class="shrink-0 text-muted-foreground" />
  <span class="min-w-0 flex-1 truncate font-medium" title={name}>{name}</span>
  <span class="ks-end" class:hint>
    <Icon name="selector" size={14} class="ks-sel shrink-0 text-faint-foreground" />
    <kbd aria-hidden="true">K</kbd>
  </span>
</SidebarMenuButton>

<style>
  .ks-end {
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .ks-end > :global(*) {
    grid-area: 1 / 1;
  }

  .ks-end kbd {
    display: grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--muted);
    font: 500 11px/1 var(--font-sans);
    color: var(--muted-foreground);
    opacity: 0;
    scale: 0.9;
  }

  .hint kbd {
    opacity: 1;
    scale: 1;
  }

  .hint :global(.ks-sel) {
    opacity: 0;
    scale: 0.6;
  }

  @media (prefers-reduced-motion: no-preference) {
    .ks-end kbd,
    .ks-end :global(.ks-sel) {
      transition:
        opacity 120ms ease-out,
        scale 120ms ease-out;
    }
  }
</style>
