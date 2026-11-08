<script>
import { Switch } from "../ui/switch/index.js";

let {
  checked = $bindable(false),
  id,
  disabled = false,
  label,
  onchange,
} = $props();
</script>

<Switch {id} {disabled} aria-label={label} class="cursor-pointer" bind:checked onCheckedChange={(v) => onchange?.(v)} />
