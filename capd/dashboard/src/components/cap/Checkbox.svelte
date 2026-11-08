<script>
import { Checkbox } from "../ui/checkbox/index.js";

let {
  checked = $bindable(false),
  id,
  disabled = false,
  label,
  onchange,
} = $props();
</script>

<Checkbox {id} {disabled} aria-label={label} class="cursor-pointer" bind:checked onCheckedChange={(v) => onchange?.(v)} />
