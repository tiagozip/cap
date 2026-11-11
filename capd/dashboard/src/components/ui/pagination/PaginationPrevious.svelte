<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";
import PaginationLink from "./PaginationLink.svelte";

let { class: className, text, ...rest } = $props();
</script>

<PaginationLink aria-label={t("Go to previous page")} size="default" class={cn("ps-1.5!", className)} {...rest}>
  <Icon name="chevron-left" data-icon="inline-start" class="rtl:-scale-x-100" />
  <span class="hidden sm:block">{text ?? t("Previous")}</span>
</PaginationLink>
