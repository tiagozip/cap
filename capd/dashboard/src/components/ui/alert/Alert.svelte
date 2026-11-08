<script>
import { tv } from "tailwind-variants";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  variant = "info",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const alertVariants = tv({
  base: "group/alert relative grid w-full grid-cols-[auto_1fr] gap-x-2.5 gap-y-0 rounded-lg px-2.5 py-2 text-start text-sm",
  variants: {
    variant: {
      error: "bg-error/10 text-error *:data-[slot=alert-mark]:bg-error",
      warning: "bg-warning/10 text-warning *:data-[slot=alert-mark]:bg-warning",
      success: "bg-success/10 text-success *:data-[slot=alert-mark]:bg-success",
      info: "bg-info/10 text-info *:data-[slot=alert-mark]:bg-info",
    },
  },
});
const marks = {
  error: "alert-circle",
  warning: "alert-circle",
  success: "circle-check",
  info: "info-circle",
};
</script>

<div bind:this={ref} data-slot="alert" role="alert" class={alertVariants({ variant, class: className })} {...rest}>
  <Icon name={marks[variant] ?? "info-circle"} data-slot="alert-mark" class="row-span-2 size-8 self-center rounded-md p-1.5 text-card" />
  {@render children?.()}
</div>
