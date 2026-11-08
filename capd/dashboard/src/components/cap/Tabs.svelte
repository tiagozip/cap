<script>
import { Badge, SlidingTabs } from "../ui/index.js";

let {
  value = $bindable(),
  items,
  label,
  onchange,
  aside,
  class: className = "",
} = $props();

const tabs = $derived(
  items.map((item) => ({
    id: item.id,
    text: item.label,
    count: item.count,
    label: item.count == null ? item.label : counted,
  })),
);
</script>

{#snippet counted(tab)}
  <span class="flex items-center gap-1.5">
    {tab.text}
    <Badge variant="secondary" size="sm" class="tabular-nums">{tab.count}</Badge>
  </span>
{/snippet}

<div class="flex items-center border-b border-border {className}">
  <div role="group" aria-label={label} class="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    <SlidingTabs
      {tabs}
      indicator="underline"
      bind:value={
        () => value ?? "",
        (v) => {
          if (v === value) return;
          value = v;
          onchange?.(v);
        }
      }
      pillClass="bg-foreground"
      tabClass="h-11 px-2 text-sm font-medium"
    />
  </div>
  {#if aside}<div class="flex shrink-0 items-center ps-3">{@render aside()}</div>{/if}
</div>
