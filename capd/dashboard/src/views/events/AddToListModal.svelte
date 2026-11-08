<script>
import { untrack } from "svelte";
import {
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { toast } from "../../lib/ui.svelte.js";
import { TTL_OPTIONS } from "./labels.js";

let { candidates, onclose } = $props();

let lists = $state([]);
let pick = $state("__new");
let newName = $state("");
let nameError = $state("");
let pickError = $state("");
let checked = $state(untrack(() => candidates.map((_, i) => i === 0)));
let ttl = $state("0");
let busy = $state(false);
let nameInput = $state(null);

api("GET", "/lists").then((l) => {
  lists = Array.isArray(l) ? l.filter((x) => !x.id.startsWith("blk_")) : [];
  if (lists.length) pick = lists[0].id;
});

const kindLabel = (k) =>
  k === "asn" ? "Network" : k === "visitor" ? "Visitor" : "IP";

async function add() {
  if (pick === "__new" && !newName.trim()) {
    nameError = "Give the new list a name.";
    nameInput?.focus();
    return;
  }
  const items = candidates.filter((_, i) => checked[i]);
  if (!items.length) {
    pickError = "Pick at least one thing to add.";
    return;
  }
  busy = true;
  let id = pick;
  if (id === "__new") {
    const created = await api("POST", "/lists", { name: newName.trim() });
    if (!created.id) {
      busy = false;
      toast(created.error || "Couldn't create the list", "error");
      return;
    }
    id = created.id;
  }
  const r = await api("POST", `/lists/${id}/items`, {
    items: items.map(({ kind, value }) => ({ kind, value, ttl: Number(ttl) })),
  });
  busy = false;
  onclose();
  if (r.success)
    toast(`Added ${r.added} ${r.added === 1 ? "entry" : "entries"}`);
  else toast(r.error || "Couldn't add to the list", "error");
}
</script>

<Dialog title="Add to a list" {onclose}>
  <Field label="List" for="addListPick">
    <Select
      id="addListPick"
      class="w-full"
      bind:value={pick}
      options={[...lists.map((l) => [l.id, l.name]), ["__new", "New list"]]}
    />
  </Field>
  {#if pick === "__new"}
    <Field label="Name" for="addListName" error={nameError}>
      <Input
        id="addListName"
        maxlength={80}
        placeholder="Known scrapers"
        bind:ref={nameInput}
        bind:value={newName}
        invalid={!!nameError}
        aria-describedby={nameError ? "addListName-error" : undefined}
        oninput={() => (nameError = "")}
      />
    </Field>
  {/if}
  <fieldset class="flex flex-col gap-1">
    <legend class="mb-1.5 text-sm font-medium">Add</legend>
    {#each candidates as c, i (i)}
      <div class="flex h-8 min-w-0 items-center gap-2.5">
        <Checkbox id="addCand{i}" bind:checked={checked[i]} onchange={() => (pickError = "")} />
        <label for="addCand{i}" class="flex min-w-0 cursor-pointer items-baseline gap-2 text-sm">
          <span class="w-14 shrink-0 text-muted-foreground">{kindLabel(c.kind)}</span>
          <span class="truncate font-mono text-xs">{c.kind === "asn" ? `AS${c.value}` : c.value}</span>
          {#if c.label}<span class="truncate text-muted-foreground">{c.label}</span>{/if}
        </label>
      </div>
    {/each}
    {#if pickError}<p class="text-sm text-destructive" role="alert">{pickError}</p>{/if}
  </fieldset>
  <Field label="Remove after" for="addListTtl">
    <Select id="addListTtl" class="w-full" bind:value={ttl} options={TTL_OPTIONS.map(([v, l]) => [String(v), l])} />
  </Field>
  {#snippet footer()}
    <Button variant="ghost" onclick={onclose}>Cancel</Button>
    <Button variant="primary" disabled={busy} onclick={add}>Add to list</Button>
  {/snippet}
</Dialog>
