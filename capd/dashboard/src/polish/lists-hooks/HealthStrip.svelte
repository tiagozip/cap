<script>
let { rows = [], max = 24, class: className = "" } = $props();

const recent = $derived(rows.slice(0, max).toReversed());
const slowest = $derived(
  Math.max(1, ...recent.filter((d) => d.ok).map((d) => d.ms ?? 0)),
);
const failed = $derived(recent.filter((d) => !d.ok).length);
</script>

{#if recent.length}
  <span class="flex h-3.5 items-end gap-px {className}" aria-hidden="true">
    {#each recent as d, i (i)}
      <span
        class="w-[3px] rounded-[1px] {d.ok ? 'bg-success/70' : 'bg-destructive'}"
        style:height="{d.ok ? Math.max(25, Math.round(((d.ms ?? 0) / slowest) * 100)) : 100}%"
      ></span>
    {/each}
  </span>
  <span class="sr-only">{failed ? `${failed} of the last ${recent.length} deliveries failed` : `The last ${recent.length} deliveries all arrived`}</span>
{/if}
