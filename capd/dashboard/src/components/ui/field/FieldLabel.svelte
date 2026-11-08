<script>
import { cn } from "../../../lib/utils.js";
import Label from "../label/Label.svelte";

let { class: className, ref = $bindable(null), children, ...rest } = $props();
</script>

<Label
  bind:ref
  data-slot="field-label"
  class={cn(
    "group/field-label peer/field-label flex w-fit gap-2 leading-snug transition-ring group-data-[disabled=true]/field:opacity-50 *:data-[slot=field]:p-2.5",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</Label>
