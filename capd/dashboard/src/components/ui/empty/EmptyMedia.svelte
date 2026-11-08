<script>
import { tv } from "tailwind-variants";

let {
  class: className,
  variant = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const media = tv({
  base: "mb-4 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
    },
  },
});
</script>

<div bind:this={ref} data-slot="empty-icon" data-variant={variant} class={media({ variant, class: className })} {...rest}>
  {@render children?.()}
</div>
