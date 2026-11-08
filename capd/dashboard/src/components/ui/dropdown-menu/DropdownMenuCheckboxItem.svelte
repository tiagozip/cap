<script>
import { DropdownMenu } from "bits-ui";
import { getContext } from "svelte";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";
import { itemBase, menuSizes, sizeKey } from "./sizes.js";

let {
  class: className,
  checked = $bindable(false),
  inset,
  marked = true,
  ref = $bindable(null),
  children: content,
  ...rest
} = $props();

const size = getContext(sizeKey);
const s = $derived(menuSizes[size?.() ?? "default"]);
</script>

<DropdownMenu.CheckboxItem
  bind:ref
  bind:checked
  data-slot="dropdown-menu-checkbox-item"
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
  {#snippet children({ checked: on })}
    {#if marked}
      <span class={cn("pointer-events-none absolute", s.mark)}>
        {#if on}<Icon name="check" />{/if}
      </span>
    {/if}
    {@render content?.()}
  {/snippet}
</DropdownMenu.CheckboxItem>
