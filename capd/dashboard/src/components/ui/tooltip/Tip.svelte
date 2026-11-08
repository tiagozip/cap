<script>
import Tooltip from "./Tooltip.svelte";
import TooltipContent from "./TooltipContent.svelte";
import TooltipTrigger from "./TooltipTrigger.svelte";

let {
  label,
  content,
  side = "top",
  align = "center",
  arrow = false,
  triggerProps,
  children,
  ...rest
} = $props();
</script>

<Tooltip {...rest}>
  <TooltipTrigger {...triggerProps}>
    {#snippet child({ props })}
      {@render children?.(props)}
    {/snippet}
  </TooltipTrigger>
  <TooltipContent {side} {align} {arrow}>
    {#if content}{@render content()}{:else}{label}{/if}
  </TooltipContent>
</Tooltip>
