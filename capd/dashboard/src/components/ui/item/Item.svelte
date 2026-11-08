<script>
import { tv } from "tailwind-variants";

let {
  class: className,
  variant = "default",
  size = "default",
  href,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const itemVariants = tv({
  base: "group/item flex w-full flex-wrap items-center rounded-lg border text-sm transition-ring outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted",
  variants: {
    variant: {
      default: "border-transparent",
      outline: "border-border",
      muted: "border-transparent bg-muted/50",
    },
    size: {
      default: "gap-2.5 px-3 py-2.5",
      sm: "gap-2.5 px-3 py-2.5",
      xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
    },
  },
});
</script>

<svelte:element
  this={href ? "a" : "div"}
  bind:this={ref}
  {href}
  data-slot="item"
  data-variant={variant}
  data-size={size}
  class={itemVariants({ variant, size, class: className })}
  {...rest}
>
  {@render children?.()}
</svelte:element>
