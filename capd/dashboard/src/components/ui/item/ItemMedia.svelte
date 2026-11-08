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
  base: "flex shrink-0 items-center justify-center gap-2 [&_svg]:pointer-events-none",
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image:
        "size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
    },
  },
});
</script>

<div bind:this={ref} data-slot="item-media" data-variant={variant} class={media({ variant, class: className })} {...rest}>
  {@render children?.()}
</div>
