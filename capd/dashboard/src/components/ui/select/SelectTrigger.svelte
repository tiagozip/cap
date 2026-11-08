<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  size = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<Select.Trigger
  bind:ref
  data-slot="select-trigger"
  data-size={size}
  class={cn(
    "flex w-fit items-center justify-between gap-1.5 rounded-lg border focus-field border-input bg-transparent py-2 ps-2.5 pe-2 text-sm whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon name="chevron-down" class="pointer-events-none size-4 text-muted-foreground" />
</Select.Trigger>
