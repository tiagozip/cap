<script>
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";

let { class: className, ...rest } = $props();
</script>

<span
  aria-hidden="true"
  data-slot="pagination-ellipsis"
  class={cn("flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4", className)}
  {...rest}
>
  <Icon name="dots" />
  <span class="sr-only">More pages</span>
</span>
