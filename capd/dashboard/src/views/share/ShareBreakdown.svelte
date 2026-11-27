<script>
import Button from "../../components/cap/Button.svelte";
import Skeleton from "../../components/cap/Skeleton.svelte";
import Card from "../../components/ui/card/Card.svelte";
import SlidingTabs from "../../components/ui/sliding-tabs/SlidingTabs.svelte";
import { compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";

let {
  tabs,
  note,
  title,
  stale = false,
  figure,
  stack = false,
  onhover,
  class: className = "",
} = $props();

const VISIBLE = 8;
const fits = (list) => (list.length <= VISIBLE + 2 ? list.length : VISIBLE);

let picked = $state(null);
let details = $state(false);
let opened = $state(false);

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

{#snippet row(r, i)}
  <li class="relative flex h-8 items-center gap-2 rounded-md px-2 text-sm" onpointerenter={() => onhover?.(r.value)} onpointerleave={() => onhover?.(null)}>
    <span
      class="bar absolute inset-y-0 start-0 rounded-md bg-foreground/[0.06] transition-[width] duration-300 ease-(--ease-out) motion-reduce:transition-none"
      style:width="{Math.max(1.5, (r.n / peak) * 100)}%"
      style:--i={Math.min(i, VISIBLE)}
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

<Card variant="layered" class="min-w-0 print:break-inside-avoid {className}" role="region" aria-label={tabs.map((t) => t.label).join(" and ")}>
  <div class="flex min-h-10 items-center gap-2 pe-3">
    {#if tabs.length === 1}
      <h2 class="px-3 pb-1 text-sm font-medium">{title ?? tab.label}</h2>
    {:else}
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
    {/if}
    {#if note}<span class="ms-auto shrink-0 pb-1 text-sm text-muted-foreground">{note}</span>{/if}
  </div>

  <div class="flex flex-1 flex-col gap-4 rounded-lg bg-background p-3 transition-opacity duration-200 {rows?.length === 0 ? '' : 'lg:min-h-72'} {figure && !stack && rows?.length !== 0 ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-center lg:gap-8 lg:p-5' : ''} {stale ? 'opacity-60' : ''}">
    {#if figure}{@render figure(rows)}{/if}
    <Skeleton class="skeleton-fill" data={rows} sample={samples.breakdown} empty={rows?.length === 0} preload={tab.image && rows?.slice(0, VISIBLE + 2).map(tab.image)} label="Loading {tab.label.toLowerCase()}">
      {#snippet emptyMessage()}
        <p class="m-auto max-w-56 py-10 text-center text-sm text-balance text-muted-foreground">{tab.empty}</p>
      {/snippet}
      {#snippet children(list)}
        {@render header()}
        <ul class="flex flex-col gap-0.5">
          {#each list.slice(0, fits(list)) as r, i (r.value)}{@render row(r, i)}{/each}
        </ul>
        {#if list.length > fits(list)}
          <div class="mt-auto flex justify-center pt-2 print:hidden">
            <Button variant="ghost" size="sm" onclick={() => {
              opened = true;
              details = true;
            }}>Show all {list.length}</Button>
          </div>
        {/if}
      {/snippet}
    </Skeleton>
  </div>
</Card>

{#if opened}
  {#await import("./ShareAll.svelte") then { default: ShareAll }}
    <ShareAll bind:open={details} title={tab.label} {rows} {header} {row} />
  {/await}
{/if}

<style>
  @media (prefers-reduced-motion: no-preference) {
    .bar {
      transform-origin: left;
      animation: grow 560ms cubic-bezier(0.22, 1, 0.36, 1) calc(var(--i) * 35ms) both;
    }

    .bar:dir(rtl) {
      transform-origin: right;
    }
  }

  @keyframes grow {
    from {
      scale: 0 1;
      opacity: 0;
    }
  }
</style>
