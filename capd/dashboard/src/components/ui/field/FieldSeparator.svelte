<script>
import { cn } from "../../../lib/utils.js";
import Separator from "../separator/Separator.svelte";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<div
  bind:this={ref}
  data-slot="field-separator"
  data-content={!!children}
  class={cn("relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2", className)}
  {...rest}
>
  <Separator class="absolute inset-0 top-1/2" />
  {#if children}
    <span class="relative mx-auto block w-fit bg-background px-2 text-muted-foreground" data-slot="field-separator-content">
      {@render children()}
    </span>
  {/if}
</div>
