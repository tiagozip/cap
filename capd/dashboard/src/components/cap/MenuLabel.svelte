<script>
import { DropdownMenuLabel } from "../ui/index.js";

let { class: className = "", children } = $props();
</script>

<DropdownMenuLabel class={className}>{@render children()}</DropdownMenuLabel>
