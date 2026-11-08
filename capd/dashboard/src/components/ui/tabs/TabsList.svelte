<script>
import { Tabs } from "bits-ui";
import { tabsListVariants } from "./variants.js";

let {
  class: className,
  variant = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Tabs.List bind:ref data-slot="tabs-list" data-variant={variant} class={tabsListVariants({ variant, class: className })} {...rest}>
  {@render children?.()}
</Tabs.List>
