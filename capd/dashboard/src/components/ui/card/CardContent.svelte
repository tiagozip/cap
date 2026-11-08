<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("card-variant");
const layered = $derived(variant?.() === "layered");
</script>

<div bind:this={ref} data-slot="card-content" class={cn("px-(--card-spacing)", layered && "flex min-w-0 flex-col overflow-hidden rounded-lg bg-background px-5", className)} {...rest}>
  {@render children?.()}
</div>
