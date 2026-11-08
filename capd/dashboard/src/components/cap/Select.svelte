<script>
import { NativeSelect } from "../ui/native-select/index.js";

let {
  value = $bindable(),
  options = [],
  size = "md",
  class: className = "",
  children,
  ...rest
} = $props();

const items = $derived(
  options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : o)),
);
</script>

<NativeSelect bind:value size={size === "sm" ? "sm" : "default"} class="cursor-pointer [&_select]:cursor-pointer {size === 'sm' ? '' : '[&_select]:h-9'} {className}" {...rest}>
  {#each items as o (o.value)}
    <option value={o.value}>{o.label}</option>
  {/each}
  {@render children?.()}
</NativeSelect>
