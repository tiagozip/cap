<script>
import { Progress } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  value = 0,
  max = 100,
  label,
  trackClass,
  indicatorClass,
  ref = $bindable(null),
  children,
  ...rest
} = $props();

const percent = $derived(
  value === null ? 0 : Math.min(100, Math.max(0, (value / max) * 100)),
);
</script>

<div bind:this={ref} data-slot="progress" class={cn("flex flex-wrap gap-3", className)} {...rest}>
  {@render children?.()}
  <Progress.Root
    {value}
    {max}
    aria-label={label}
    data-slot="progress-track"
    class={cn("relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted", trackClass)}
  >
    <div
      data-slot="progress-indicator"
      class={cn("h-full w-full bg-primary motion-safe:transition-[translate] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]", indicatorClass)}
      style:translate={`${percent - 100}% 0`}
    ></div>
  </Progress.Root>
</div>
