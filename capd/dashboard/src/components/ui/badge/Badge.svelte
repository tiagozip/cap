<script>
import { badgeVariants } from "./variants.js";

let {
  class: className,
  variant = "default",
  size = "default",
  href,
  onclick,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const tag = $derived(href ? "a" : onclick ? "button" : "span");
</script>

<svelte:element
  this={tag}
  bind:this={ref}
  data-slot="badge"
  data-variant={variant}
  {href}
  type={tag === "button" ? "button" : undefined}
  {onclick}
  class={badgeVariants({ variant, size, class: className })}
  {...rest}
>
  {@render children?.()}
</svelte:element>
