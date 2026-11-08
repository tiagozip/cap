<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("card-variant");
const layered = $derived(variant?.() === "layered");
</script>

<div bind:this={ref} data-slot="card-title" class={cn("text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", layered && "text-sm font-semibold", className)} {...rest}>
  {@render children?.()}
</div>
