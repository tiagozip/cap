<script>
import { t } from "../../lib/i18n.svelte.js";
import { CopyButton } from "../ui/index.js";

let { value, label, secret = false } = $props();
</script>

<div class="flex h-9 w-full min-w-0 items-center gap-2 rounded-[10px] bg-muted pr-1 pl-3">
  <code class="min-w-0 flex-1 truncate font-mono text-sm {secret ? 'blur-[3px] transition-[filter] duration-150 hover:blur-none focus-within:blur-none' : ''}">{value}</code>
  <CopyButton text={value} label={label ?? t("Copy")} />
</div>
