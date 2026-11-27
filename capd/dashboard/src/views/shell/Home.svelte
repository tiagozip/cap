<script>
import { cubicOut } from "svelte/easing";
import {
  Button,
  Empty,
  Icon,
  PageHeader,
  Table,
  Tag,
} from "../../components/cap/index.js";
import Odometer from "../../components/cap/Odometer.svelte";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { compact } from "../../lib/format.js";
import { watchKeyCounts } from "../../lib/live-keys.svelte.js";
import { app, navigate } from "../../lib/state.svelte.js";

const total = $derived(
  app.keys.reduce((n, k) => n + (k.solvesLast24h || 0), 0),
);
const nf = new Intl.NumberFormat();
const top = $derived(Math.max(1, ...app.keys.map((k) => k.solvesLast24h || 0)));

const swap = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches
    ? { duration: 0 }
    : {
        duration: 220,
        easing: cubicOut,
        css: (t) =>
          `opacity: ${t}; scale: ${0.25 + 0.75 * t}; filter: blur(${4 * (1 - t)}px)`,
      };

const pct = (key) => Math.round(Math.abs(Number(key.difference?.value) || 0));

const open = (siteKey) => navigate({ view: "key", siteKey, tab: "activity" });

$effect(() => watchKeyCounts(15_000));
</script>

{#snippet create()}
  <Button variant="primary" onclick={() => (app.createKeyOpen = true)}>
    <Icon name="plus" size={14} />
    Create site key
  </Button>
{/snippet}

<PageHeader
  title="Site keys"
  actions={app.keys.length ? create : undefined}
  description={!app.route.error && app.keys.length
    ? `${nf.format(total)} solves across ${app.keys.length} ${app.keys.length === 1 ? "key" : "keys"} in the last 24 hours.`
    : undefined}
/>

{#if app.route.error}
  <p role="status" class="flex items-start gap-2 px-4 py-3.5 text-sm text-pretty text-muted-foreground md:px-5">
    <Icon name="info" size={14} class="mt-0.5 shrink-0 text-warning" />
    <span>Couldn't open that key: {app.route.error}</span>
  </p>
{/if}

{#if app.keysError}
  <div class="px-4 md:px-5"><Empty title="Couldn't load your site keys">{app.keysError}</Empty></div>
{:else if app.keys.length}
  <Table flush class="border-t border-border {app.route.error ? '' : 'mt-4'}">
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead class="max-sm:hidden">Site key</TableHead>
        <TableHead class="w-[28%] max-md:hidden"><span class="sr-only">Share of solves</span></TableHead>
        <TableHead class="text-right!">Solves, 24 hours</TableHead>
        <TableHead class="w-10"><span class="sr-only">Open</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each app.keys as key (key.siteKey)}
        {@const dir = key.difference?.direction}
        <TableRow
          data-clickable
          class="group cursor-pointer transition-colors duration-100 active:bg-muted"
          onclick={() => open(key.siteKey)}
        >
          <TableCell>
            <a
              href="#/keys/{key.siteKey}/activity"
              class="flex min-w-0 items-center gap-2.5 font-medium outline-none focus-visible:underline focus-visible:underline-offset-4"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                open(key.siteKey);
              }}
            >
              <span class="truncate" title={key.name}>{key.name}</span>
              {#if key.secretOutdated}<Tag tone="danger">Reset secret</Tag>{/if}
            </a>
          </TableCell>
          <TableCell class="font-mono text-xs text-muted-foreground max-sm:hidden">{key.siteKey}</TableCell>
          <TableCell class="max-md:hidden" aria-hidden="true">
            <span class="home-bar"><span style:scale="{(key.solvesLast24h || 0) / top} 1"></span></span>
          </TableCell>
          <TableCell>
            <span class="flex items-center justify-end gap-1.5 font-medium tabular-nums">
              <span class="grid size-3 place-items-center" aria-hidden="true">
                {#if dir === "up"}
                  <span class="[grid-area:1/1]" transition:swap><Icon name="trendUp" size={12} class="text-success" /></span>
                {:else if dir === "down"}
                  <span class="[grid-area:1/1]" transition:swap><Icon name="trendDown" size={12} class="text-destructive" /></span>
                {/if}
              </span>
              {#if dir && pct(key)}
                <span class="text-xs font-normal {dir === 'up' ? 'text-success' : 'text-destructive'}"><span class="sr-only">{dir === "up" ? "up" : "down"} from the day before by </span>{dir === "up" ? "+" : "\u2212"}{pct(key)}%</span>
              {:else if dir === "up"}<span class="sr-only">up from the day before,</span>{:else if dir === "down"}<span class="sr-only">down from the day before,</span>{/if}
              <Odometer value={key.solvesLast24h || 0} format={compact} />
            </span>
          </TableCell>
          <TableCell class="text-right">
            <Icon
              name="right"
              size={14}
              class="inline text-faint-foreground transition-[translate,color] duration-150 ease-out group-hover:text-muted-foreground motion-safe:group-hover:translate-x-0.5"
            />
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{:else}
  {#await import("./EmptyKeys.svelte") then { default: EmptyKeys }}<EmptyKeys />{/await}
{/if}

<style>
  .home-bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in oklch, var(--foreground) 6%, transparent);
    overflow: hidden;
  }

  .home-bar > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: color-mix(in oklch, var(--foreground) 35%, transparent);
    transform-origin: left;
  }

  @media (prefers-reduced-motion: no-preference) {
    .home-bar > span {
      transition: scale 600ms cubic-bezier(0.23, 1, 0.32, 1);
    }
  }
</style>
