<script>
import { getContext, untrack } from "svelte";
import { cn } from "../../../lib/utils.js";
import Textarea from "../textarea/Textarea.svelte";

let {
  class: className,
  value = $bindable(),
  ref = $bindable(null),
  ...rest
} = $props();

const group = getContext("input-group");

$effect(() => {
  if (!group) return;
  untrack(() => {
    group.textarea = (group.textarea ?? 0) + 1;
  });
  return () => {
    group.textarea -= 1;
  };
});
</script>

<Textarea
  bind:ref
  bind:value
  data-slot="input-group-control"
  class={cn(
    "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 [--field-focus-width:0px] disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
    className,
  )}
  {...rest}
/>
