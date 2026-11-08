<script>
import { Select } from "bits-ui";
import { cn } from "../../../lib/utils.js";

let { class: className, ref = $bindable(null), ...rest } = $props();
</script>

<Select.Value bind:ref data-slot="select-value" class={cn("flex flex-1 text-start", className)} {...rest} />
