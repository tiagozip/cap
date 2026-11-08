<script>
import { setContext } from "svelte";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), children, ...rest } = $props();

const parts = $state({});
setContext("input-group", parts);
</script>

<div
  bind:this={ref}
  data-slot="input-group"
  role="group"
  data-addon-inline-start={parts["inline-start"] > 0 || undefined}
  data-addon-inline-end={parts["inline-end"] > 0 || undefined}
  data-addon-block-start={parts["block-start"] > 0 || undefined}
  data-addon-block-end={parts["block-end"] > 0 || undefined}
  data-textarea={parts.textarea > 0 || undefined}
  class={cn(
    "group/input-group relative flex h-8 w-full min-w-0 items-center rounded-lg border focus-field border-input in-data-[slot=combobox-content]:outline-none in-data-[slot=combobox-content]:[--field-focus-width:0px] in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 data-addon-block-end:h-auto data-addon-block-end:flex-col data-addon-block-start:h-auto data-addon-block-start:flex-col data-textarea:h-auto dark:bg-input/30 data-addon-block-end:[&>input]:pt-3 data-addon-block-start:[&>input]:pb-3",
    "not-rtl:data-addon-inline-end:[&>input]:pr-1.5 not-rtl:data-addon-inline-start:[&>input]:pl-1.5 rtl:data-addon-inline-end:[&>input]:pl-1.5 rtl:data-addon-inline-start:[&>input]:pr-1.5",
    className,
  )}
  {...rest}
>
  {@render children?.()}
</div>
