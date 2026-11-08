<script>
import { cn } from "../../../lib/utils.js";
import Separator from "../separator/Separator.svelte";

let { class: className, ...rest } = $props();
</script>

<Separator data-slot="sidebar-separator" data-sidebar="separator" class={cn("mx-2 w-auto bg-sidebar-border", className)} {...rest} />
