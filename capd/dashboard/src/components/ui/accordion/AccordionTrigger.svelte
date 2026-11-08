<script>
import { Accordion } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("accordion-variant");
const primary = $derived((variant?.() ?? "primary") === "primary");
const morph =
  "transition-[d] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";
</script>

<Accordion.Header class="flex">
  <Accordion.Trigger
    bind:ref
    data-slot="accordion-trigger"
    class={cn(
      "group/accordion-trigger relative flex w-full flex-1 items-center justify-between gap-4 text-start transition-ring outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:pointer-events-none disabled:opacity-50",
      primary ? "py-5 text-base leading-6 font-semibold" : "px-5 py-4 text-sm font-semibold",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if primary}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="pointer-events-none size-[1.125rem] shrink-0 text-foreground/50 transition-colors duration-200 group-hover/accordion-trigger:text-foreground/80"
      >
        <path d="M 6 9 L 12 15" class={cn(morph, "group-aria-expanded/accordion-trigger:[d:path('M_6_6_L_18_18')]")} />
        <path d="M 18 9 L 12 15" class={cn(morph, "group-aria-expanded/accordion-trigger:[d:path('M_18_6_L_6_18')]")} />
      </svg>
    {:else}
      <Icon
        name="plus"
        class="pointer-events-none size-5 shrink-0 text-muted-foreground transition-[rotate,color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/accordion-trigger:text-foreground group-aria-expanded/accordion-trigger:rotate-45 group-aria-expanded/accordion-trigger:text-foreground"
      />
    {/if}
  </Accordion.Trigger>
</Accordion.Header>
