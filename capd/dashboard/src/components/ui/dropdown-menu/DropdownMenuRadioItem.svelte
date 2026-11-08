<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";
import { itemBase, menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  value,
  inset,
  marked = true,
  ref = $bindable(null),
  children: content,
  ...rest
} = $props();

const size = getContext(sizeKey);
const s = $derived(menuSizes[size?.() ?? "default"]);
</script>

<DropdownMenu.RadioItem
  bind:ref
  {value}
  data-slot="dropdown-menu-radio-item"
  data-inset={inset || undefined}
  class={cn(
    itemBase,
    marked ? s.check : s.row,
    s.inset,
    s.icon,
    "relative data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
    className,
  )}
  {...rest}
>
  {#snippet children({ checked })}
    {#if marked}
      <span class={cn("pointer-events-none absolute", s.mark)}>
        {#if checked}<Icon name="check" />{/if}
      </span>
    {/if}
    {@render content?.()}
  {/snippet}
</DropdownMenu.RadioItem>
