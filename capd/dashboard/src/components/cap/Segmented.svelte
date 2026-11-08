<script>
import { SlidingTabs } from "../ui/index.js";

let {
  value = $bindable(),
  options,
  label,
  danger = [],
  size = "md",
  onchange,
  class: className = "",
} = $props();

const tabs = $derived(
  options.map((o) =>
    Array.isArray(o)
      ? { id: o[0], label: o[1] }
      : { id: o.value, label: o.label },
  ),
);
</script>

<div role="group" aria-label={label} class="flex shrink-0 {className}">
  <SlidingTabs
    {tabs}
    bind:value={
      () => value ?? "",
      (v) => {
        if (!v || v === value) return;
        value = v;
        onchange?.(v);
      }
    }
    class="w-full rounded-lg bg-foreground/6 p-0.5"
    pillClass="rounded-md"
    tabClass="flex-1 rounded-md {size === 'sm' ? 'px-2.5 py-0.5 text-sm' : 'px-3 py-1 text-sm'}"
    activeTabClass={danger.includes(value) ? "text-destructive" : undefined}
  />
</div>
