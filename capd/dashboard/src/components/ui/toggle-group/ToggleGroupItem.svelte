<script>
import { ToggleGroup } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import { toggleVariants } from "../toggle/variants.js";

let {
  class: className,
  value,
  variant = "default",
  size = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const group = getContext("toggle-group");
const v = $derived(group?.variant || variant);
const s = $derived(group?.size || size);
</script>

<ToggleGroup.Item
  bind:ref
  {value}
  data-slot="toggle-group-item"
  data-variant={v}
  data-size={s}
  data-spacing={group?.spacing}
  class={cn(
    "shrink-0 focus:z-10 focus-visible:z-10",
    "group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2",
    "group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:first:rounded-s-lg group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:last:rounded-e-lg group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s",
    "group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
    toggleVariants({ variant: v, size: s }),
    className,
  )}
  {...rest}
>
  {@render children?.()}
</ToggleGroup.Item>
