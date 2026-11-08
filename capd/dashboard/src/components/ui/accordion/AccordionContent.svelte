<script>
import { Accordion } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("accordion-variant");
</script>

<Accordion.Content
  bind:ref
  data-slot="accordion-content"
  class="overflow-hidden duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none"
  {...rest}
>
  <div
    class={cn(
      (variant?.() ?? "primary") === "primary"
        ? "pb-5 text-base leading-[1.625] text-foreground/70 transition-opacity duration-300 ease-out in-data-ending-style:opacity-0 in-data-starting-style:opacity-0"
        : "px-5 pt-0 pb-4 text-[0.9375rem] leading-relaxed text-muted-foreground",
      "[&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
      className,
    )}
  >
    {@render children?.()}
  </div>
</Accordion.Content>
