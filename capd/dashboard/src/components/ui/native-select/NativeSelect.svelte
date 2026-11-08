<script>
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  size = "default",
  value = $bindable(),
  disabled,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<div
  class={cn("group/native-select relative w-fit data-disabled:opacity-50", className)}
  data-slot="native-select-wrapper"
  data-size={size}
  data-disabled={disabled || undefined}
>
  <select
    bind:this={ref}
    bind:value
    {disabled}
    data-slot="native-select"
    data-size={size}
    class="[&_option]:bg-[Canvas] [&_option]:text-[CanvasText] [&_optgroup]:bg-[Canvas] [&_optgroup]:text-[CanvasText] h-8 w-full min-w-0 appearance-none rounded-lg border focus-field border-input bg-transparent py-1 ps-2.5 pe-8 text-sm select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
    {...rest}
  >
    {@render children?.()}
  </select>
  <Icon
    name="chevron-down"
    class="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground select-none"
    data-slot="native-select-icon"
  />
</div>
