<script>
import { Select } from "bits-ui";

let {
  open = $bindable(false),
  value = $bindable(),
  type = "single",
  children,
  ...rest
} = $props();
</script>

<Select.Root {type} bind:open bind:value={() => value ?? (type === "multiple" ? [] : ""), (v) => (value = v)} {...rest}>
  {@render children?.()}
</Select.Root>
