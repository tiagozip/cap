<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("card-variant");
const layered = $derived(variant?.() === "layered");
</script>

<div bind:this={ref} data-slot="card-header" class={cn("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) [.border-b]:pb-(--card-spacing)", layered && "gap-x-6 gap-y-0.5 px-4 pt-2.5 pb-3 @max-sm/card-header:grid-cols-1!", className)} {...rest}>
  {@render children?.()}
</div>
