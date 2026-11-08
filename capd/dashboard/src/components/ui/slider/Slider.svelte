<script>
import { Slider } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  type = "single",
  value = $bindable(),
  min = 0,
  max = 100,
  orientation = "horizontal",
  size = "default",
  thumbLabel,
  ref = $bindable(null),
  ...rest
} = $props();

const thumbClasses = { default: "size-[26px]", sm: "size-4" };
let pointer = false;
let keyboardFocus = $state(false);
</script>

<Slider.Root
  bind:ref
  {type}
  bind:value={() => value ?? (type === "multiple" ? [min, max] : min), (v) => (value = v)}
  {min}
  {max}
  {orientation}
  data-slot="slider"
  class={cn(
    "relative flex touch-none items-center select-none data-disabled:opacity-50 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
    className,
  )}
  onpointerdown={() => {
    pointer = true;
  }}
  {...rest}
>
  {#snippet children({ thumbItems })}
    <span
      data-slot="slider-track"
      data-orientation={orientation}
      class="relative grow overflow-hidden rounded-full bg-(--slider-track) select-none [--slider-track:color-mix(in_oklch,var(--muted),var(--foreground)_10%)] data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 dark:[--slider-track:var(--muted)]"
    >
      <Slider.Range data-slot="slider-range" class="bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
    </span>
    {#each thumbItems as { index } (index)}
      <Slider.Thumb
        {index}
        data-slot="slider-thumb"
        aria-label={Array.isArray(thumbLabel) ? thumbLabel[index] : thumbLabel}
        onfocus={() => {
          keyboardFocus = !pointer;
          pointer = false;
        }}
        onkeydown={() => {
          keyboardFocus = true;
        }}
        class={cn(
          "relative block shrink-0 rounded-full bg-primary ring-offset-background outline-hidden transition-ring select-none after:absolute after:-inset-2 data-disabled:pointer-events-none",
          thumbClasses[size],
          keyboardFocus && "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      />
    {/each}
  {/snippet}
</Slider.Root>
