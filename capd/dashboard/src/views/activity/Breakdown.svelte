<script>
import { Button, Dialog, Input, Skeleton } from "../../components/cap/index.js";
import { Card, SlidingTabs } from "../../components/ui/index.js";
import { compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";

let { tabs, tint = "var(--foreground)", stale = false, onpick } = $props();

const VISIBLE = 8;

let active = $state(tabs[0].id);
let details = $state(false);
let query = $state("");

const tab = $derived(tabs.find((t) => t.id === active) ?? tabs[0]);
const rows = $derived(tab.rows);
const peak = $derived(
  Math.max(1, ...(rows ?? samples.breakdown).map((r) => r.n)),
);

const filtered = $derived(
  query.trim()
    ? (rows ?? []).filter((r) =>
        tab.name(r).toLowerCase().includes(query.trim().toLowerCase()),
      )
    : (rows ?? []),
);

const share = (r) => (r.n ? (r.blocked ?? 0) / r.n : 0);
</script>

{#snippet header()}
  <div class="flex items-center gap-2 px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">
    <span class="mr-auto">{tab.column}</span>
    {#if tab.risk}<span class="w-14 text-right">Blocked</span>{/if}
    <span class="w-14 text-right">Events</span>
  </div>
{/snippet}

{#snippet row(r)}
  {@const s = share(r)}
  <li>
    <button
      type="button"
      class="group relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] transition-[scale] duration-150"
      title="Show events where {tab.column.toLowerCase()} is {tab.name(r)}"
      onclick={() => {
        details = false;
        onpick([`${tab.field}:${r.value}`]);
      }}
    >
      <span
        class="absolute inset-y-0 left-0 rounded-md transition-[width,background-color] duration-300 ease-(--ease-out) motion-reduce:transition-none"
        style:width="{Math.max(1.5, (r.n / peak) * 100)}%"
        style:background="color-mix(in oklab, {tint} 10%, transparent)"
      ></span>
      <span data-bone="ignore" class="absolute inset-0 rounded-md bg-foreground/0 transition-[background-color] duration-100 [@media(hover:hover)]:group-hover:bg-foreground/[0.035]"></span>
      <span class="relative flex min-w-0 flex-1 items-center gap-2">
        {#if tab.icon}{@render tab.icon(r)}{/if}
        <span class="truncate">{tab.name(r)}</span>
      </span>
      {#if tab.risk}
        <span class="relative w-14 text-right text-xs tabular-nums {s >= 0.1 ? 'font-medium text-destructive' : 'text-muted-foreground'}">
          {s ? `${s < 0.01 ? "<1" : Math.round(s * 100)}%` : ""}
        </span>
      {/if}
      <span class="relative w-14 text-right font-medium tabular-nums">{compact(r.n)}</span>
    </button>
  </li>
{/snippet}

<Card variant="layered" class="min-w-0">
<div class="flex flex-1 flex-col">
  <div class="overflow-x-auto px-1 pb-1">
    <SlidingTabs
      tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
      bind:value={active}
      flat
      pillClass="rounded-lg bg-background"
      activeTabClass="text-foreground"
      tabClass="rounded-lg px-3 py-1.5 text-sm font-medium"
    />
  </div>

  <div
    class="flex flex-1 flex-col rounded-lg bg-background p-3 lg:min-h-72 transition-opacity duration-200 {stale ? 'opacity-60' : ''}"
  >
    {#if tab.body}
      {@render tab.body()}
    {:else}
      <Skeleton class="skeleton-fill" data={rows} sample={samples.breakdown} empty={rows?.length === 0} preload={tab.image && rows?.slice(0, VISIBLE).map(tab.image)} label="Loading {tab.label.toLowerCase()}">
        {#snippet emptyMessage()}
          <p class="m-auto max-w-56 text-center text-sm text-balance text-muted-foreground">{tab.empty}</p>
        {/snippet}
        {#snippet children(list)}
          {@render header()}
          <ul class="flex flex-col gap-0.5">
            {#each list.slice(0, VISIBLE) as r (r.value)}{@render row(r)}{/each}
          </ul>
          {#if list.length > VISIBLE}
            <div class="mt-auto flex justify-center pt-2">
              <Button variant="ghost" size="sm" onclick={() => (details = true)}>
                Show all {list.length}
              </Button>
            </div>
          {/if}
        {/snippet}
      </Skeleton>
    {/if}
  </div>
</div>
</Card>

{#if details}
  <Dialog title={tab.label} size="md" onclose={() => ((details = false), (query = ""))}>
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
{/if}
