<script>
import {
  Button,
  Empty,
  Icon,
  Input,
  Skeleton,
  Table,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { samples } from "../../lib/samples.js";
import { app } from "../../lib/state.svelte.js";
import {
  entryLabel,
  entryMatcher,
  kindSummary,
} from "../../polish/lists-hooks/entries.js";
import ListEditor from "../lists/ListEditor.svelte";

let lists = $state(null);
let usedBy = $state({});
let items = $state({});
let error = $state("");
let editing = $state(undefined);
let query = $state("");
let editQuery = $state("");

const nf = new Intl.NumberFormat();

const matcher = $derived(entryMatcher(query));
const hits = $derived.by(() => {
  if (!matcher || !lists) return null;
  const out = {};
  for (const l of lists) {
    const found = items[l.id]?.filter(matcher);
    if (found?.length) out[l.id] = found;
  }
  return out;
});
const hitCount = $derived(hits ? Object.keys(hits).length : 0);
const loadingItems = $derived(
  !!lists && lists.some((l) => items[l.id] === undefined),
);

async function load() {
  const [l, perKey] = await Promise.all([
    api("GET", "/lists"),
    Promise.all(
      app.keys.map((k) =>
        api("GET", `/keys/${k.siteKey}/rules`).then((r) => [k.name, r]),
      ),
    ),
  ]);
  if (!Array.isArray(l)) {
    error = l?.error || "Couldn't load lists";
    return;
  }
  error = "";
  lists = l.filter((x) => !x.id.startsWith("blk_"));
  const map = {};
  for (const [name, rules] of perKey) {
    if (!Array.isArray(rules)) continue;
    for (const r of rules)
      for (const c of r.conditions ?? [])
        if (c.field === "list") {
          map[c.value] ??= new Set();
          map[c.value].add(name);
        }
  }
  usedBy = Object.fromEntries(
    Object.entries(map).map(([id, names]) => [id, [...names]]),
  );
  const details = await Promise.all(
    lists.map((x) =>
      api("GET", `/lists/${x.id}`).then((d) => [
        x.id,
        Array.isArray(d?.items) ? d.items : null,
      ]),
    ),
  );
  items = Object.fromEntries(details);
}
load();
</script>

<Skeleton data={lists} sample={samples.lists} {error} empty={lists?.length === 0} label="Loading lists">
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{error}</p>
  {/snippet}
  {#snippet emptyMessage()}
    <Empty title="No shared lists yet">
      Make one when several keys should block or allow the same IPs, networks or countries.
      {#snippet action()}
        <Button variant="primary" class="ps-3" onclick={() => (editing = null)}><Icon name="plus" size={15} />New list</Button>
      {/snippet}
    </Empty>
  {/snippet}
  {#snippet children(rows)}
    <div class="flex flex-col gap-4 pb-4">
      {#if rows.length > 1}
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4">
          <label for="listLookup" class="sr-only">Check an IP, ASN, country or user agent against every list</label>
          <div class="w-72 max-w-full">
            <Input id="listLookup" type="search" icon="search" size="sm" placeholder="Check an IP, ASN or country" bind:value={query} />
          </div>
          {#if hits}
            <p class="text-sm text-muted-foreground tabular-nums" role="status">
              {#if loadingItems}
                Checking lists
              {:else if hitCount}
                On {nf.format(hitCount)} of {nf.format(rows.length)} lists
              {:else}
                Not on any list
              {/if}
            </p>
          {/if}
        </div>
      {/if}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead class="w-px whitespace-nowrap">Entries</TableHead>
            <TableHead class="hidden sm:table-cell">Used by</TableHead>
            <TableHead class="w-px"><span class="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each rows as l (l.id)}
            {@const keys = usedBy[l.id] ?? []}
            {@const found = hits?.[l.id]}
            {@const all = items[l.id]}
            <TableRow class="sl-row" data-dim={(hits && !found) || undefined}>
              <TableCell class="w-full max-w-0">
                <span class="flex min-w-0 flex-col gap-0.5">
                  <span class="truncate font-medium" title={l.name}>{l.name}</span>
                  {#if found}
                    <button
                      type="button"
                      class="-mx-1 cursor-pointer truncate rounded-sm px-1 text-start text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:underline"
                      title={found.map(entryLabel).join(", ")}
                      onclick={() => {
                        editQuery = query.trim();
                        editing = l.id;
                      }}
                    >
                      Has <code class="font-mono">{entryLabel(found[0])}</code>{#if found.length > 1}<span class="text-muted-foreground"> and {nf.format(found.length - 1)} more</span>{/if}{#if found[0].note}<span class="text-muted-foreground">, {found[0].note}</span>{/if}
                    </button>
                  {:else if all?.length}
                    <span class="truncate text-xs text-muted-foreground">{kindSummary(all)}</span>
                  {/if}
                </span>
              </TableCell>
              <TableCell class="text-muted-foreground tabular-nums">{nf.format(l.count)}</TableCell>
              <TableCell class="hidden max-w-64 truncate text-muted-foreground sm:table-cell" title={keys.join(", ")}>{keys.length ? keys.join(", ") : "No rules yet"}</TableCell>
              <TableCell class="text-end">
                <Button variant="ghost" size="sm" aria-label="Edit {l.name}" onclick={() => {
                    editQuery = "";
                    editing = l.id;
                  }}>Edit</Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <div>
        <Button class="ps-3" onclick={() => (editing = null)}><Icon name="plus" size={15} />New list</Button>
      </div>
    </div>
  {/snippet}
</Skeleton>

{#if editing !== undefined}
  <ListEditor
    id={editing}
    usedBy={editing ? (usedBy[editing] ?? []) : null}
    query={editing ? editQuery : ""}
    onchange={load}
    onclose={() => (editing = undefined)}
  />
{/if}

<style>
  :global(.sl-row[data-dim]) {
    opacity: 0.45;
  }

  @media (prefers-reduced-motion: no-preference) {
    :global(.sl-row) {
      transition-property: opacity;
      transition-duration: 180ms;
      transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    }
  }
</style>
