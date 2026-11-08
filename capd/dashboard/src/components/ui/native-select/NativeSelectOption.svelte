<script>
import { cn } from "../../../lib/utils.js";

let { class: className, children, ...rest } = $props();
</script>

<option data-slot="native-select-option" class={cn("bg-[Canvas] text-[CanvasText]", className)} {...rest}>
  {@render children?.()}
</option>
