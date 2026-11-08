<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let {
  class: className,
  value,
  label,
  ref = $bindable(null),
  children: content,
  ...rest
} = $props();
</script>

<Select.Item
  bind:ref
  {value}
  {label}
  data-slot="select-item"
  class={cn(
    "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 ps-1.5 pe-8 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
    className,
  )}
  {...rest}
>
  {#snippet children({ selected })}
    <span class="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
      {#if content}{@render content()}{:else}{label ?? value}{/if}
    </span>
    {#if selected}
      <span class="pointer-events-none absolute end-2 flex size-4 items-center justify-center">
        <Icon name="check" class="pointer-events-none" />
      </span>
    {/if}
  {/snippet}
</Select.Item>
