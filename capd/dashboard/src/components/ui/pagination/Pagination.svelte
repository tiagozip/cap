<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";

let {
  class: className,
  label,
  ref = $bindable(null),
  children,
  ...rest
} = $props();
</script>

<nav bind:this={ref} aria-label={label ?? t("Pagination")} data-slot="pagination" class={cn("mx-auto flex w-full justify-center", className)} {...rest}>
  {@render children?.()}
</nav>
