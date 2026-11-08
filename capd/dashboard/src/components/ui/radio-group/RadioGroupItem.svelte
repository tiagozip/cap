<script>
import { RadioGroup } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, value, ref = $bindable(null), ...rest } = $props();
</script>

<RadioGroup.Item
  bind:ref
  {value}
  data-slot="radio-group-item"
  class={cn(
    "group/radio-group-item peer relative flex aspect-square size-4 shrink-0 rounded-full border border-input transition-ring outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
    className,
  )}
  {...rest}
>
  {#snippet children({ checked })}
    <span
      data-slot="radio-group-indicator"
      data-state={checked ? "checked" : "unchecked"}
      class="pointer-events-none absolute inset-[3px] z-10 rounded-full bg-primary transition-[scale,opacity] duration-200 ease-out data-[state=unchecked]:scale-0 data-[state=unchecked]:opacity-0 motion-reduce:transition-none"
    ></span>
  {/snippet}
</RadioGroup.Item>
