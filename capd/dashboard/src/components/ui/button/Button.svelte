<script>
import { buttonVariants } from "./variants.js";

let {
  class: className,
  variant = "default",
  size = "default",
  rounded = false,
  flat = false,
  href,
  type = "button",
  disabled,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    data-variant={variant}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    class={buttonVariants({ variant, size, rounded, flat, class: className })}
    {...rest}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    data-variant={variant}
    {type}
    {disabled}
    class={buttonVariants({ variant, size, rounded, flat, class: className })}
    {...rest}
  >
    {@render children?.()}
  </button>
{/if}
