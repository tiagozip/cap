<script>
import { Checkbox } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  shape = "square",
  checked = $bindable(false),
  indeterminate = $bindable(false),
  ref = $bindable(null),
  ...rest
} = $props();

const shapes = { square: "rounded-[4px]", round: "rounded-full" };
</script>

<Checkbox.Root
  bind:ref
  bind:checked
  bind:indeterminate
  data-slot="checkbox"
  data-shape={shape}
  class={cn(
    "t-check",
    "peer relative flex size-4 shrink-0 items-center justify-center border border-input outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:bg-primary",
    shapes[shape],
    className,
  )}
  {...rest}
>
  {#snippet children({ indeterminate: mixed })}
    <span data-slot="checkbox-indicator" class="grid place-content-center text-current">
      {#if mixed}
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="size-3">
          <path d="M2 5h6" />
        </svg>
      {:else}
        <svg
          viewBox="-0.3 -0.3 11 8.6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="size-3"
        >
          <path d="M1 4L3.8 7L9.4 1" />
        </svg>
      {/if}
    </span>
  {/snippet}
</Checkbox.Root>
