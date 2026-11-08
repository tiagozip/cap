<script>
import { Button, Dialog, Input, Skeleton } from "../../components/cap/index.js";
import { Card, SlidingTabs } from "../../components/ui/index.js";
import { compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";

let { tabs, note, stale = false } = $props();

const VISIBLE = 8;

let picked = $state(null);
let details = $state(false);
let query = $state("");

const tab = $derived(tabs.find((t) => t.id === picked) ?? tabs[0]);
const rows = $derived(tab.rows);
const peak = $derived(
  Math.max(1, ...(rows ?? samples.breakdown).map((r) => r.n)),
);
const total = $derived(
  Math.max(
    1,
    tab.total ?? (rows ?? samples.breakdown).reduce((sum, r) => sum + r.n, 0),
  ),
);

const filtered = $derived.by(() => {
  const q = query.trim().toLowerCase();
  if (!q) return rows ?? [];
  return (rows ?? []).filter((r) => r.name.toLowerCase().includes(q));
});

const pct = (n) => {
  const v = (n / total) * 100;
  if (v > 0 && v < 1) return "<1%";
  return `${Math.round(v)}%`;
};
</script>

{#snippet header()}
  <div class="flex items-center gap-2 px-2 pb-1.5 text-xs font-medium text-muted-foreground">
    <span class="me-auto">{tab.column}</span>
    <span class="w-12 text-right">Share</span>
    <span class="w-14 text-right">Events</span>
  </div>
{/snippet}

{#snippet row(r)}
  <li class="relative flex h-8 items-center gap-2 rounded-md px-2 text-sm">
    <span
      class="absolute inset-y-0 start-0 rounded-md bg-foreground/[0.06] transition-[width] duration-300 ease-(--ease-out) motion-reduce:transition-none"
      style:width="{Math.max(1.5, (r.n / peak) * 100)}%"
      aria-hidden="true"
    ></span>
    <span class="relative flex min-w-0 flex-1 items-center gap-2">
      {#if tab.icon}{@render tab.icon(r)}{/if}
      <span class="truncate" title={r.name}>{r.name}</span>
    </span>
    <span class="relative w-12 text-right text-xs text-muted-foreground tabular-nums">{pct(r.n)}</span>
    <span class="relative w-14 text-right font-medium tabular-nums">{compact(r.n)}</span>
  </li>
{/snippet}

<Card variant="layered" class="min-w-0" role="region" aria-label={tabs.map((t) => t.label).join(" and ")}>
  <div class="flex items-center gap-2 pe-3">
    <div class="min-w-0 overflow-x-auto px-1 pb-1">
      <SlidingTabs
        tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
        bind:value={() => tab.id, (v) => (picked = v)}
        flat
        pillClass="rounded-lg bg-background"
        activeTabClass="text-foreground"
        tabClass="rounded-lg px-3 py-1.5 text-sm font-medium"
      />
    </div>
    {#if note}<span class="ms-auto shrink-0 pb-1 text-sm text-muted-foreground">{note}</span>{/if}
  </div>

  <div class="flex flex-1 flex-col rounded-lg bg-background p-3 transition-opacity duration-200 lg:min-h-72 {stale ? 'opacity-60' : ''}">
    <Skeleton class="skeleton-fill" data={rows} sample={samples.breakdown} empty={rows?.length === 0} preload={tab.image && rows?.slice(0, VISIBLE).map(tab.image)} label="Loading {tab.label.toLowerCase()}">
      {#snippet emptyMessage()}
        <p class="m-auto max-w-56 py-10 text-center text-sm text-balance text-muted-foreground">{tab.empty}</p>
      {/snippet}
      {#snippet children(list)}
        {@render header()}
        <ul class="flex flex-col gap-0.5">
          {#each list.slice(0, VISIBLE) as r (r.value)}{@render row(r)}{/each}
        </ul>
        {#if list.length > VISIBLE}
          <div class="mt-auto flex justify-center pt-2">
            <Button variant="ghost" size="sm" onclick={() => (details = true)}>Show all {list.length}</Button>
          </div>
        {/if}
      {/snippet}
    </Skeleton>
  </div>
</Card>

<Dialog bind:open={details} title={tab.label} size="md" onclose={() => (query = "")}>
  <Input icon="search" type="search" placeholder="Search {tab.label.toLowerCase()}" aria-label="Search {tab.label.toLowerCase()}" bind:value={query} />
  <div class="-mx-2 max-h-[60dvh] overflow-y-auto">
    {@render header()}
    <ul class="flex flex-col gap-0.5">
      {#each filtered as r (r.value)}{@render row(r)}{/each}
    </ul>
    {#if !filtered.length}
      <p class="py-8 text-center text-sm text-muted-foreground">Nothing matches "{query}"</p>
    {/if}
  </div>
</Dialog>
