<script>
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), ...rest } = $props();
</script>

<div bind:this={ref} role="none" data-slot="select-separator" class={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)} {...rest}></div>
