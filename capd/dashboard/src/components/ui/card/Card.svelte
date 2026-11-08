<script>
import { setContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  size = "default",
  variant = "default",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

setContext("card-variant", () => variant);
</script>

<div
  bind:this={ref}
  data-slot="card"
  data-size={size}
  data-variant={variant}
  class={cn(
    "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10 [--card-spacing:--spacing(4)] data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
    variant === "layered" && "gap-0 bg-muted p-1 ring-border",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</div>
