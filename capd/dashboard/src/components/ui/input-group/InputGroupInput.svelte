<script>
import { cn } from "../../../lib/utils.js";
import Input from "../input/Input.svelte";

let {
  class: className,
  value = $bindable(),
  ref = $bindable(null),
  ...rest
} = $props();
</script>

<Input
  bind:ref
  bind:value
  data-slot="input-group-control"
  class={cn(
    "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 [--field-focus-width:0px] disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
    className,
  )}
  {...rest}
/>
