<script>
import { Tabs } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  value = $bindable(""),
  orientation = "horizontal",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Tabs.Root
  bind:ref
  bind:value
  {orientation}
  data-slot="tabs"
  data-orientation={orientation}
  class={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
  {...rest}
>
  {@render children?.()}
</Tabs.Root>
