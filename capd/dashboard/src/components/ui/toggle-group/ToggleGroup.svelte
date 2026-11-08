<script>
import { ToggleGroup } from "bits-ui";
import { setContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  type = "single",
  value = $bindable(),
  variant,
  size,
  spacing = 2,
  orientation = "horizontal",
  style,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

setContext("toggle-group", {
  get variant() {
    return variant;
  },
  get size() {
    return size;
  },
  get spacing() {
    return spacing;
  },
});
</script>

<ToggleGroup.Root
  bind:ref
  {type}
  bind:value={() => value ?? (type === "multiple" ? [] : ""), (v) => (value = v)}
  {orientation}
  data-slot="toggle-group"
  data-variant={variant}
  data-size={size}
  data-spacing={spacing}
  data-orientation={orientation}
  style={`--gap: ${spacing};${style ?? ""}`}
  class={cn(
    "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[size=sm]:rounded-[min(var(--radius-md),10px)]",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</ToggleGroup.Root>
