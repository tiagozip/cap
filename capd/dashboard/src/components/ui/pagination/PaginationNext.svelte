<script>
import { t } from "../../../lib/i18n.svelte.js";
import { cn } from "../../../lib/utils.js";
import Icon from "../icon/Icon.svelte";
import PaginationLink from "./PaginationLink.svelte";

let { class: className, text, ...rest } = $props();
</script>

<PaginationLink aria-label={t("Go to next page")} size="default" class={cn("pe-1.5!", className)} {...rest}>
  <span class="hidden sm:block">{text ?? t("Next")}</span>
  <Icon name="chevron-right" data-icon="inline-end" class="rtl:-scale-x-100" />
</PaginationLink>
