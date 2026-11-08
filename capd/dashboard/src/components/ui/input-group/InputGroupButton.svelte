<script>
import { getContext, untrack } from "svelte";
import { tv } from "tailwind-variants";
import Button from "../button/Button.svelte";

let {
  class: className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const addon = getContext("input-group-addon");

$effect(() => {
  if (!addon) return;
  untrack(() => {
    addon.buttons += 1;
  });
  return () => {
    addon.buttons -= 1;
  };
});

const groupButton = tv({
  base: "flex items-center gap-2 text-sm shadow-none",
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "",
      "icon-xs": "size-6 rounded-[calc(var(--radius)-3px)] p-0",
      "icon-sm": "size-8 p-0",
    },
  },
});
</script>

<Button bind:ref {type} data-size={size} {variant} class={groupButton({ size, class: className })} {...rest}>
  {@render children?.()}
</Button>
