<script>
import { Tabs } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  value,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Tabs.Content bind:ref {value} data-slot="tabs-content" class={cn("flex-1 text-sm outline-none", className)} {...rest}>
  {@render children?.()}
</Tabs.Content>
