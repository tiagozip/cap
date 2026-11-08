<script>
import { buttonVariants } from "../ui/button/variants.js";

let {
  variant = "secondary",
  size = "md",
  icon = false,
  href,
  type = "button",
  class: className = "",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const VARIANTS = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
  "danger-ghost": "ghost",
  link: "link",
};
const SIZES = {
  sm: ["default", "icon"],
  md: ["lg", "icon-lg"],
  lg: ["lg", "icon-lg"],
};

const classes = $derived(
  buttonVariants({
    variant: VARIANTS[variant],
    size: SIZES[size][icon ? 1 : 0],
    class: `cursor-pointer ${variant === "danger-ghost" ? "text-destructive" : ""} ${className}`,
  }),
);
</script>

{#if href}
  <a bind:this={ref} {href} class={classes} {...rest}>{@render children?.()}</a>
{:else}
  <button bind:this={ref} {type} class={classes} {...rest}>{@render children?.()}</button>
{/if}
