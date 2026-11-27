<script module>
import { api } from "../../lib/api.js";

let cache = null;

export const prefetchLists = () => {
  cache ??= api("GET", "/lists").then((l) =>
    Array.isArray(l) ? l.filter((x) => !x.id.startsWith("blk_")) : [],
  );
  cache.then((l) => {
    if (!l.length) cache = null;
  });
  return cache;
};

const LAST = "cap.addToList.last";
const readLast = () => {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
};
const writeLast = (id) => {
  try {
    localStorage.setItem(LAST, id);
  } catch {}
};
</script>

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
import { compact } from "../../lib/format.js";
import { toast } from "../../lib/ui.svelte.js";
import { TTL_OPTIONS } from "./labels.js";

let { candidates, onLists = [], checkAll = false, onclose } = $props();

let lists = $state(null);
let pick = $state("__new");
let newName = $state("");
let nameError = $state("");
let pickError = $state("");
let checked = $state(
  untrack(() => candidates.map((_, i) => checkAll || i === 0)),
);
let ttl = $state("0");
let nameInput = $state(null);

prefetchLists().then((l) => {
  lists = l;
  const last = readLast();
  pick = l.find((x) => x.id === last)?.id ?? l[0]?.id ?? "__new";
});

const bare = (v) => String(v).replace(/^AS/i, "");
const already = (c) =>
  onLists.some(
    (l) => l.id === pick && l.kind === c.kind && bare(l.value) === bare(c.value),
  );

const mixed = $derived(new Set(candidates.map((c) => c.kind)).size > 1);

const noun = (k) => (k === "ip" ? "IP" : k === "asn" ? "network" : "visitor");

const picked = $derived(
  candidates.filter((c, i) => checked[i] && !already(c)).length,
);

const kindLabel = (k) =>
  k === "asn" ? "Network" : k === "visitor" ? "Visitor" : "IP";

async function add() {
  if (pick === "__new" && !newName.trim()) {
    nameError = "Give the new list a name.";
    nameInput?.focus();
    return;
  }
  const items = candidates.filter((c, i) => checked[i] && !already(c));
  if (!items.length) {
    pickError = "Pick at least one thing to add.";
    return;
  }
  const name =
    pick === "__new" ? newName.trim() : lists.find((l) => l.id === pick)?.name;
  onclose();
  let id = pick;
  if (id === "__new") {
    const created = await api("POST", "/lists", { name });
    if (!created?.id) {
      toast(created?.error || "Couldn't create the list", "error");
      return;
    }
    id = created.id;
    cache = null;
  }
  writeLast(id);
  const r = await api("POST", `/lists/${id}/items`, {
    items: items.map(({ kind, value }) => ({ kind, value, ttl: Number(ttl) })),
  });
  if (!r?.success) {
    toast(r?.error || "Couldn't add to the list", "error");
    return;
  }
  cache = null;
  toast(
    r.added
      ? `Added ${r.added} ${r.added === 1 ? "entry" : "entries"} to ${name}`
      : `Already in ${name}`,
  );
}
</script>

<Dialog title="Add to a list" {onclose}>
  <fieldset class="flex flex-col">
    <legend class="mb-1.5 text-sm font-medium">List</legend>
    <div class="-mx-2 flex max-h-56 flex-col overflow-y-auto" role="radiogroup">
      {#if lists === null}
        {#each [0, 1] as i (i)}
          <div class="flex h-9 items-center gap-2.5 px-2" aria-hidden="true">
            <span class="size-4 rounded-full bg-muted"></span>
            <span class="h-3 w-28 rounded-sm bg-muted"></span>
          </div>
        {/each}
      {:else}
        {#each [...lists.map((l) => [l.id, l.name, l.count]), ["__new", "New list", null]] as [lid, name, count] (lid)}
          <label class="flex h-9 min-w-0 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm transition-[background-color] duration-100 [@media(hover:hover)]:hover:bg-muted">
            <input
              type="radio"
              name="addListPick"
              value={lid}
              bind:group={pick}
              class="peer size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-background outline-none checked:border-[5px] checked:border-primary focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-[border-width,border-color] motion-safe:duration-150"
              onchange={() => {
                if (lid === "__new") queueMicrotask(() => nameInput?.focus());
              }}
            />
            <span class="min-w-0 flex-1 truncate {lid === '__new' ? 'text-muted-foreground peer-checked:text-foreground' : ''}">{name}</span>
            {#if count != null}<span class="shrink-0 text-xs text-muted-foreground tabular-nums">{compact(count)}<span class="sr-only"> entries</span></span>{/if}
          </label>
        {/each}
      {/if}
    </div>
  </fieldset>
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
        onkeydown={(ev) => {
          if (ev.key !== "Enter" || ev.isComposing) return;
          ev.preventDefault();
          add();
        }}
      />
    </Field>
  {/if}
  <fieldset class="flex flex-col">
    <legend class="mb-1.5 text-sm font-medium">Add{#if !mixed && candidates[0]}<span class="ms-1 font-normal">{noun(candidates[0].kind)}{candidates.length > 1 ? "s" : ""}</span>{/if}{#if candidates.length > 3}<span class="ms-1.5 font-normal text-muted-foreground tabular-nums">{picked} of {candidates.length}</span>{/if}</legend>
    <div class="-mx-2 flex max-h-56 flex-col overflow-y-auto {candidates.length > 6 ? '[mask-image:linear-gradient(to_bottom,black_85%,transparent)] pb-6' : ''}">
      {#each candidates as c, i (i)}
        {@const on = already(c)}
        <div class="flex h-9 min-w-0 shrink-0 items-center gap-2.5 rounded-md px-2 transition-[background-color] duration-100 {on ? '' : '[@media(hover:hover)]:hover:bg-muted'}">
          <Checkbox id="addCand{i}" disabled={on} bind:checked={() => checked[i] && !on, (v) => (checked[i] = v)} onchange={() => (pickError = "")} />
          <label for="addCand{i}" class="flex h-full min-w-0 flex-1 items-center gap-2 text-sm {on ? 'opacity-60' : 'cursor-pointer'}">
            {#if mixed}<span class="w-16 shrink-0 text-muted-foreground">{kindLabel(c.kind)}</span>{/if}
            <span class="truncate font-mono text-xs transition-[color] duration-150 {checked[i] ? 'text-foreground' : 'text-muted-foreground'}" title={c.value}>{c.kind === "asn" ? `AS${c.value}` : c.value}</span>
            {#if c.label}<span class="truncate text-muted-foreground" title={c.label}>{c.label}</span>{/if}
            {#if on}<span class="ms-auto shrink-0 text-xs text-muted-foreground">Already on it</span>{/if}
          </label>
        </div>
      {/each}
    </div>
    {#if pickError}<p class="text-sm text-destructive" role="alert">{pickError}</p>{/if}
  </fieldset>
  <Field label="Remove after" for="addListTtl">
    <Select id="addListTtl" class="w-full" bind:value={ttl} options={TTL_OPTIONS.map(([v, l]) => [String(v), l])} />
  </Field>
  {#snippet footer()}
    <Button variant="ghost" onclick={onclose}>Cancel</Button>
    <Button variant="primary" disabled={lists === null} onclick={add}>{picked > 1 ? `Add ${picked} ${mixed ? "entries" : `${noun(candidates[0].kind)}s`}` : "Add to list"}</Button>
  {/snippet}
</Dialog>
