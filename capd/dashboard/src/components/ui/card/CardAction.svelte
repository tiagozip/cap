<script>
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const variant = getContext("card-variant");
const layered = $derived(variant?.() === "layered");
</script>

<div bind:this={ref} data-slot="card-action" class={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", layered && "flex items-center gap-2 self-center @max-sm/card-header:col-start-1 @max-sm/card-header:row-span-1 @max-sm/card-header:row-start-auto @max-sm/card-header:mt-2 @max-sm/card-header:justify-self-start", className)} {...rest}>
  {@render children?.()}
</div>
