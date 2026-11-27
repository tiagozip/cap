<script>
import { ago, compact } from "../../lib/format.js";
import { openEvents } from "../../lib/state.svelte.js";

let { rows, onpick = openEvents } = $props();

const most = $derived(Math.max(1, ...rows.map((r) => r.ips)));
const bad = (r) => (r.n ? Math.min(1, (r.flagged + r.blocked) / r.n) : 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const percent = (s) => (s && s < 0.01 ? "<1%" : `${Math.round(s * 100)}%`);
</script>

{#if !rows.length}
  <p class="m-auto max-w-72 py-8 text-center text-sm text-balance text-muted-foreground">No browser showed up from three or more IP addresses in this period.</p>
{:else}
  <div class="-mx-2 flex flex-col">
    <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_5rem] gap-x-6 px-2 pb-1.5 text-[11px] font-medium text-muted-foreground max-sm:hidden" aria-hidden="true">
      <span>Browser</span>
      <span>Addresses</span>
      <span class="text-end">Events</span>
      <span class="text-end">Last seen</span>
    </div>
    <ul class="flex flex-col gap-0.5">
      {#each rows as r (r.fp)}
        {@const share = bad(r)}
        {@const risky = share >= 0.25}
        <li>
          <button
            type="button"
            class="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-md px-2 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_5.5rem_5rem] sm:gap-x-6 [@media(hover:hover)]:hover:bg-nav-hover"
            title="Show events from this browser"
            onclick={() => onpick([`fp:${r.fp}`])}
          >
            <span class="flex min-w-0 flex-col">
              <span class="truncate">{r.browser || "Unknown"} on {r.os || "unknown"}</span>
              <span class="truncate text-xs text-muted-foreground tabular-nums">{r.fp}<span class="ms-2 sm:hidden">{ago(r.last)}</span></span>
            </span>
            <span class="flex min-w-0 flex-col gap-1.5 max-sm:col-span-2 max-sm:row-start-2">
              <span class="flex min-w-0 items-baseline gap-2">
                <span class="shrink-0 font-medium tabular-nums">{plural(r.ips, "IP")}</span>
                <span class="truncate text-xs text-muted-foreground">{plural(r.networks, "network")}, {plural(r.countries, "country", "countries")}</span>
              </span>
              <span class="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span class="block h-full rounded-full {risky ? 'bg-destructive/70' : 'bg-(--chart-1)'}" style:width="{(r.ips / most) * 100}%"></span>
              </span>
            </span>
            <span class="flex flex-col items-end max-sm:col-start-2 max-sm:row-start-1">
              <span class="font-medium tabular-nums">{compact(r.n)}</span>
              {#if share}
                <span class="text-xs tabular-nums {risky ? 'text-destructive' : 'text-muted-foreground'}">{percent(share)} flagged</span>
              {/if}
            </span>
            <span class="text-end text-muted-foreground tabular-nums max-sm:hidden">{ago(r.last)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
  <p class="mt-3 border-t border-border pt-3 text-sm text-pretty text-muted-foreground">One fingerprint behind many addresses is usually a bot rotating proxies.</p>
{/if}
