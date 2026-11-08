<script>
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  checked = $bindable(false),
  onCheckedChange,
  onclick,
  ref = $bindable(null),
  ...rest
} = $props();
</script>

<button
  bind:this={ref}
  type="button"
  role="switch"
  aria-checked={checked}
  data-slot="switch"
  data-on={checked ? "true" : "false"}
  class={cn(
    "t-toggle",
    "peer group/switch relative inline-flex h-[18.4px] w-[32.66px] shrink-0 items-center rounded-full border border-transparent outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[on=false]:bg-input data-[on=true]:bg-primary dark:data-[on=false]:bg-input/80",
    className,
  )}
  onclick={(event) => {
    checked = !checked;
    onCheckedChange?.(checked);
    onclick?.(event);
  }}
  {...rest}
>
  <span
    aria-hidden="true"
    data-slot="switch-thumb"
    class="t-toggle-thumb pointer-events-none ms-px block h-3.5 rounded-full bg-background rtl:-scale-x-100 dark:group-data-[on=false]/switch:bg-foreground dark:group-data-[on=true]/switch:bg-primary-foreground"
  ></span>
</button>
