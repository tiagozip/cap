<script>
import { cn } from "../../../lib/utils.js";

let { class: className, children, ...rest } = $props();
</script>

<optgroup data-slot="native-select-optgroup" class={cn("bg-[Canvas] text-[CanvasText]", className)} {...rest}>
  {@render children?.()}
</optgroup>
