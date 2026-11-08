<script>
import Button from "../button/Button.svelte";
import Icon from "../icon/Icon.svelte";
import { useSidebar } from "./context.svelte.js";

let {
  onclick,
  label = "Toggle sidebar",
  ref = $bindable(null),
  ...rest
} = $props();

const sidebar = useSidebar();
</script>

<Button
  bind:ref
  data-sidebar="trigger"
  data-slot="sidebar-trigger"
  variant="ghost"
  size="icon-sm"
  aria-label={label}
  aria-expanded={sidebar.isMobile ? sidebar.openMobile : sidebar.open}
  onclick={(event) => {
    onclick?.(event);
    sidebar.toggle();
  }}
  {...rest}
>
  <Icon name="layout-sidebar" class="rtl:-scale-x-100" />
</Button>
