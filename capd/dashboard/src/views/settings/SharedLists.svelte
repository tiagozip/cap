<script>
import {
  Button,
  Empty,
  Icon,
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
import ListEditor from "../lists/ListEditor.svelte";

let lists = $state(null);
let usedBy = $state({});
let error = $state("");
let editing = $state(undefined);

const nf = new Intl.NumberFormat();

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
        <Button variant="primary" onclick={() => (editing = null)}><Icon name="plus" size={15} />New list</Button>
      {/snippet}
    </Empty>
  {/snippet}
  {#snippet children(rows)}
    <div class="flex flex-col gap-4 pb-4">
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
            <TableRow>
              <TableCell class="max-w-56 truncate font-medium" title={l.name}>{l.name}</TableCell>
              <TableCell class="text-muted-foreground tabular-nums">{nf.format(l.count)}</TableCell>
              <TableCell class="hidden max-w-64 truncate text-muted-foreground sm:table-cell" title={keys.join(", ")}>{keys.length ? keys.join(", ") : "No rules yet"}</TableCell>
              <TableCell class="text-end">
                <Button variant="ghost" size="sm" aria-label="Edit {l.name}" onclick={() => (editing = l.id)}>Edit</Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <div>
        <Button onclick={() => (editing = null)}><Icon name="plus" size={15} />New list</Button>
      </div>
  </div>
  {/snippet}
</Skeleton>

{#if editing !== undefined}
  <ListEditor
    id={editing}
    usedBy={editing ? (usedBy[editing] ?? []) : null}
    onchange={load}
    onclose={() => (editing = undefined)}
  />
{/if}
