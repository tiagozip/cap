<script>
import { Accordion } from "bits-ui";
import { setContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  type = "single",
  value = $bindable(),
  variant = "primary",
  ref = $bindable(null),
  children,
  ...rest
} = $props();

setContext("accordion-variant", () => variant);
</script>

<Accordion.Root
  bind:ref
  {type}
  bind:value={() => value ?? (type === "multiple" ? [] : ""), (v) => (value = v)}
  data-slot="accordion"
  data-variant={variant}
  class={cn("flex w-full flex-col", variant === "secondary" && "gap-3", className)}
  {...rest}
>
  {@render children?.()}
</Accordion.Root>
