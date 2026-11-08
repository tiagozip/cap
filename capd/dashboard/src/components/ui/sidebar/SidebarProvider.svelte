<script>
import { cn } from "../../../lib/utils.js";
import { createSidebar } from "./context.svelte.js";

let {
  open = $bindable(true),
  onOpenChange,
  class: className,
  style,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const sidebar = createSidebar({
  open: () => open,
  setOpen: (value) => {
    open = value;
    onOpenChange?.(value);
  },
});

$effect(() => {
  const root = document.documentElement;
  root.dataset.sidebarShell = "";
  return () => delete root.dataset.sidebarShell;
});

$effect(() => {
  const query = window.matchMedia("(max-width: 767px)");
  const sync = () => {
    sidebar.isMobile = query.matches;
  };
  sync();
  query.addEventListener("change", sync);
  return () => query.removeEventListener("change", sync);
});
</script>

<svelte:window
  onkeydown={(event) => {
    if ((event.key === "b" || (event.code === "KeyB" && !/^[a-z]$/i.test(event.key))) && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sidebar.toggle();
    }
  }}
/>

<div
  bind:this={ref}
  data-slot="sidebar-wrapper"
  style={`--sidebar-width: 16rem; --sidebar-width-icon: 3rem;${style ?? ""}`}
  data-inset={sidebar.inset || undefined}
  class={cn("group/sidebar-wrapper flex min-h-svh w-full data-inset:bg-sidebar", className)}
  {...rest}
>
  {@render children?.()}
</div>
