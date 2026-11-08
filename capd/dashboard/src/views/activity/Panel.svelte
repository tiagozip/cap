<script>
import { Card } from "../../components/ui/index.js";

let { title, aside, stale = false, class: cls = "", children } = $props();
</script>

<Card variant="layered" class="min-w-0 {cls}" role="region" aria-label={title}>
  <div class="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 py-1 ps-3 pe-1">
    <h2 class="text-sm font-medium">{title}</h2>
    {#if aside}<div class="ms-auto flex items-center gap-2">{@render aside()}</div>{/if}
  </div>
  <div class="flex flex-1 flex-col rounded-lg bg-background p-4 transition-opacity duration-200 {stale ? 'opacity-60' : ''}">
    {@render children()}
  </div>
</Card>
