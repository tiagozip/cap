<script>
import { Accordion } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  value,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const variant = getContext("accordion-variant");
</script>

<Accordion.Item
  bind:ref
  {value}
  data-slot="accordion-item"
  class={cn(
    "overflow-hidden",
    (variant?.() ?? "primary") === "primary" ? "border-t border-foreground/15 first:border-t-0" : "rounded-2xl border bg-card shadow-sm",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</Accordion.Item>
