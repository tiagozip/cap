<script>
import {
  Button,
  Empty,
  Icon,
  PageHeader,
  Table,
  Tag,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { compact } from "../../lib/format.js";
import { app, navigate } from "../../lib/state.svelte.js";

const total = $derived(
  app.keys.reduce((n, k) => n + (k.solvesLast24h || 0), 0),
);
const nf = new Intl.NumberFormat();
</script>

<PageHeader
  title="Site keys"
  description={app.route.error
    ? `Couldn't open that key: ${app.route.error}`
    : app.keys.length
      ? `${nf.format(total)} solves across ${app.keys.length} ${app.keys.length === 1 ? "key" : "keys"} in the last 24 hours.`
      : "Create a key for your website, add the widget to a form, and check the token on your server."}
>
  {#snippet actions()}
    <Button variant="primary" onclick={() => (app.createKeyOpen = true)}>
      <Icon name="plus" size={14} />
      Create site key
    </Button>
  {/snippet}
</PageHeader>

{#if app.keysError}
  <div class="px-4 md:px-5"><Empty title="Couldn't load your site keys">{app.keysError}</Empty></div>
{:else if app.keys.length}
  <Table flush class="border-t border-border">
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead class="max-sm:hidden">Site key</TableHead>
        <TableHead class="text-right!">Solves, 24 hours</TableHead>
        <TableHead class="w-10"><span class="sr-only">Open</span></TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each app.keys as key (key.siteKey)}
        {@const dir = key.difference?.direction}
        <TableRow
          data-clickable
          class="cursor-pointer"
          onclick={() => navigate({ view: "key", siteKey: key.siteKey, tab: "activity" })}
        >
          <TableCell>
            <a
              href="#/keys/{key.siteKey}/activity"
              class="flex items-center gap-2.5 font-medium outline-none focus-visible:underline"
              onclick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate({ view: "key", siteKey: key.siteKey, tab: "activity" });
              }}
            >
              <span class="truncate">{key.name}</span>
              {#if key.secretOutdated}<Tag tone="danger">Reset secret</Tag>{/if}
            </a>
          </TableCell>
          <TableCell class="font-mono text-xs text-muted-foreground max-sm:hidden">{key.siteKey}</TableCell>
          <TableCell class="text-right">
            <span class="inline-flex items-center gap-1.5 font-medium tabular-nums">
              {#if dir === "up"}<Icon name="trendUp" size={12} class="text-success" />{:else if dir === "down"}<Icon name="trendDown" size={12} class="text-destructive" />{/if}
              {compact(key.solvesLast24h || 0)}
            </span>
          </TableCell>
          <TableCell class="text-right"><Icon name="right" size={14} class="inline text-faint-foreground" /></TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{/if}
