<script>
import { cn } from "../../../lib/utils.js";
import Separator from "../separator/Separator.svelte";

let { class: className, ...rest } = $props();
</script>

<Separator data-slot="item-separator" orientation="horizontal" class={cn("my-2", className)} {...rest} />
