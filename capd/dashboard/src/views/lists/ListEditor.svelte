<script>
import { untrack } from "svelte";
import {
  Button,
  Drawer,
  Empty,
  Field,
  Icon,
  Input,
  Segmented,
  Select,
  Skeleton,
  Table,
  Textarea,
} from "../../components/cap/index.js";
import { TableBody, TableCell, TableRow } from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { ago, compact, fullFmt, until } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { confirm, copy, toast } from "../../lib/ui.svelte.js";
import {
  COUNT_LABELS,
  countryName,
  ipProbe,
  KIND_LABELS,
  KIND_ORDER,
  keyOf,
  parseEntries,
  stripLines,
} from "../../polish/lists-hooks/entries.js";
import { countryFlag, TTL_OPTIONS } from "../events/labels.js";

let {
  id = null,
  usedBy = null,
  stacked = false,
  query = "",
  onclose,
  onchange,
} = $props();

const PREVIEW_MAX = 12;
const RANGE_WORDS = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

const nf = new Intl.NumberFormat();
const lf = new Intl.ListFormat("en", { type: "conjunction" });
const plural = (n, one, many = `${one}s`) =>
  `${nf.format(n)} ${n === 1 ? one : many}`;

let open = $state(true);
let listId = $state(untrack(() => id));
let list = $state(null);
let loading = $state(!!untrack(() => id));
let name = $state("");
let nameError = $state("");
let savingName = $state(false);
let input = $state("");
let inputError = $state("");
let ttl = $state("0");
let adding = $state(false);
let filter = $state(untrack(() => query));
let fresh = $state(new Set());
let leaving = $state(new Set());
let kindFilter = $state("all");
let hits = $state(null);
let hitRange = $state("7d");

const view = $derived(list ?? samples.list);
const existing = $derived(new Set(view.items.map(keyOf)));
const parsed = $derived(parseEntries(input, existing));
const additions = $derived(parsed.filter((p) => p.status === "new"));
const bad = $derived(
  parsed.filter((p) => p.status === "invalid" || p.status === "duplicate"),
);
const known = $derived(parsed.filter((p) => p.status === "existing"));
const preview = $derived(
  [...bad, ...additions, ...known].slice(0, PREVIEW_MAX),
);
const summary = $derived.by(() => {
  const byKind = {};
  for (const p of additions) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
  return KIND_ORDER.filter((k) => byKind[k])
    .map((k) => plural(byKind[k], ...COUNT_LABELS[k]))
    .join(", ");
});
const kinds = $derived.by(() => {
  const byKind = {};
  for (const i of view.items) byKind[i.kind] = (byKind[i.kind] ?? 0) + 1;
  return KIND_ORDER.filter((k) => byKind[k]).map((k) => [k, byKind[k]]);
});
const hitOf = (i) => {
  if (!hits || hits.uncounted?.includes(i.kind)) return undefined;
  return (
    hits.hits?.[keyOf(i)] ??
    (hits.counted < hits.total ? undefined : { n: 0, blocked: 0 })
  );
};
const unused = $derived(
  hits ? view.items.filter((i) => hitOf(i)?.n === 0).length : 0,
);
const counting = $derived(!!hits && view.items.some((i) => hitOf(i)));
const probe = $derived(ipProbe(filter));
const matching = $derived.by(() => {
  const kind =
    kindFilter === "unused" && unused
      ? "unused"
      : kinds.some(([k]) => k === kindFilter)
        ? kindFilter
        : "all";
  const items =
    kind === "all"
      ? view.items
      : kind === "unused"
        ? view.items.filter((i) => hitOf(i)?.n === 0)
        : view.items.filter((i) => i.kind === kind);
  const q = filter.trim().toLowerCase();
  const found = probe
    ? items.filter(probe)
    : q
      ? items.filter((i) =>
          `${i.kind === "asn" ? `as${i.value}` : i.value} ${KIND_LABELS[i.kind] ?? i.kind} ${i.kind === "country" ? countryName(i.value) : ""} ${i.note}`
            .toLowerCase()
            .includes(q),
        )
      : items;
  return found;
});
const shown = $derived(
  (hits
    ? matching.toSorted((a, b) => (hitOf(b)?.n ?? -1) - (hitOf(a)?.n ?? -1))
    : matching
  ).slice(0, 2000),
);
const narrowed = $derived(
  !!filter.trim() ||
    (kindFilter === "unused" && unused > 0) ||
    (kindFilter !== "all" && kinds.some(([k]) => k === kindFilter)),
);

const asLine = (i) => {
  const v =
    i.kind === "asn"
      ? `AS${i.value}`
      : i.kind === "org" || i.kind === "ua"
        ? `${i.kind}:${i.value}`
        : i.value;
  return i.note ? `${v} # ${i.note}` : v;
};

let dragging = $state(false);

async function importFile(file) {
  if (!file) return;
  if (file.size > 4_000_000) {
    inputError = "That file is over 4 MB. Split it into smaller files.";
    return;
  }
  const text = await file.text();
  input = input.trim() ? `${input.trimEnd()}\n${text}` : text;
  inputError = "";
  document.getElementById("listInput")?.focus();
}

async function removeMatching() {
  const items = matching;
  const ok = await confirm({
    title: `Remove ${plural(items.length, "entry", "entries")}?`,
    message: "Rules using this list stop matching them right away.",
    confirmText: "Remove",
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", `/lists/${listId}/items`, {
    items: items.map(({ kind, value }) => ({ kind, value })),
  });
  if (!res.success) {
    toast(res.error || "Couldn't remove the entries", "error");
    return;
  }
  const gone = new Set(items.map(keyOf));
  list.items = list.items.filter((i) => !gone.has(keyOf(i)));
  filter = "";
  kindFilter = "all";
  toast(`Removed ${plural(items.length, "entry", "entries")}`);
  onchange?.(list);
}
const chipValue = (p) =>
  p.kind === "asn" && p.status !== "invalid" ? `AS${p.value}` : p.value;

async function loadHits() {
  if (!listId) return;
  const range = hitRange;
  const res = await api("GET", `/lists/${listId}/hits?range=${range}`);
  if (range !== hitRange) return;
  hits = res?.hits ? res : null;
}

async function load() {
  const detail = await api("GET", `/lists/${listId}`);
  list = detail?.id ? detail : null;
  name = list?.name ?? "";
  loading = false;
  loadHits();
}
if (listId) load();

const close = () => {
  open = false;
  onclose?.();
};

async function saveName(e) {
  e.preventDefault();
  const n = name.trim();
  if (!n) {
    nameError = "Give the list a name.";
    document.getElementById("listEditorName")?.focus();
    return;
  }
  savingName = true;
  if (!listId) {
    const res = await api("POST", "/lists", { name: n });
    savingName = false;
    if (!res.id) {
      nameError = res.error || "Couldn't create the list";
      return;
    }
    listId = res.id;
    list = { id: res.id, name: n, items: [] };
    onchange?.(list);
    requestAnimationFrame(() => document.getElementById("listInput")?.focus());
    return;
  }
  const res = await api("PUT", `/lists/${listId}`, { name: n });
  savingName = false;
  if (!res.success) {
    nameError = res.error || "Couldn't rename the list";
    return;
  }
  list.name = n;
  toast("List renamed");
  onchange?.(list);
}

async function addEntries(e) {
  e.preventDefault();
  if (!additions.length) {
    inputError = parsed.length
      ? "Nothing new to add. Fix or remove the lines marked below."
      : "Paste at least one entry.";
    document.getElementById("listInput")?.focus();
    return;
  }
  adding = true;
  const batch = additions.map(({ kind, value, note }) => ({
    kind,
    value,
    ...(note && { note }),
    ttl: Number(ttl),
  }));
  const res = { success: true, added: 0, rejected: [] };
  for (let i = 0; i < batch.length; i += 10_000) {
    const part = await api("POST", `/lists/${listId}/items`, {
      items: batch.slice(i, i + 10_000),
    });
    if (!part.success) {
      res.success = res.added > 0;
      res.error = part.error;
      break;
    }
    res.added += part.added ?? 0;
    res.rejected.push(...(part.rejected ?? []));
  }
  adding = false;
  if (!res.success) {
    toast(res.error || "Couldn't add entries", "error");
    return;
  }
  const skipped = res.rejected?.length ?? 0;
  const left = parsed.filter((p) => p.status === "invalid").length;
  toast(
    `Added ${plural(res.added, "entry", "entries")}${skipped ? `, ${nf.format(skipped)} rejected` : ""}${left ? `. ${plural(left, "invalid line")} left to fix` : ""}`,
    skipped ? "error" : "ok",
  );
  input = parsed
    .filter((p) => p.status === "invalid")
    .map((p) => p.raw)
    .join("\n");
  const before = new Set(list.items.map(keyOf));
  await load();
  fresh = new Set(list?.items.map(keyOf).filter((k) => !before.has(k)));
  setTimeout(() => {
    fresh = new Set();
  }, 700);
  onchange?.(list);
}

async function removeItem(item) {
  const k = keyOf(item);
  if (leaving.has(k)) return;
  leaving = new Set(leaving).add(k);
  const [res] = await Promise.all([
    api("DELETE", `/lists/${listId}/items`, {
      items: [{ kind: item.kind, value: item.value }],
    }),
    new Promise((r) => setTimeout(r, 160)),
  ]);
  leaving.delete(k);
  leaving = new Set(leaving);
  if (!res.success) {
    toast(res.error || "Couldn't remove the entry", "error");
    return;
  }
  list.items = list.items.filter((i) => i !== item);
  onchange?.(list);
}

async function deleteList() {
  const ok = await confirm({
    title: `Delete ${list.name}?`,
    message: usedBy?.length
      ? `Rules on ${lf.format(usedBy)} check this list. They stop matching once it's gone.`
      : "No rule checks this list, so nothing else changes.",
    confirmText: "Delete list",
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", `/lists/${listId}`);
  if (!res.success) {
    toast(res.error || "Couldn't delete the list", "error");
    return;
  }
  toast("List deleted");
  onchange?.(null);
  close();
}
</script>

<Drawer
  bind:open
  {stacked}
  title={listId ? (list?.name ?? "List") : "New shared list"}
  description={listId ? "Shared list" : "Shared by every site key"}
  onclose={close}
>
  <Skeleton {loading} empty={!!listId && !list} label="Loading list">
    {#snippet emptyMessage()}
      <Empty title="This list no longer exists">Someone deleted it. Close this and pick another list.</Empty>
    {/snippet}
    <div class="flex flex-col gap-6">
      {#if listId && usedBy}
        <p class="text-sm text-pretty text-muted-foreground">
          {usedBy.length ? `Rules on ${lf.format(usedBy)} check this list.` : "No rule checks this list yet. Pick it in a rule's \"is on list\" condition to use it."}
        </p>
      {/if}
      <form class="flex items-end gap-2" onsubmit={saveName} novalidate>
        <Field label="Name" for="listEditorName" error={nameError} class="min-w-0 flex-1">
          <Input
            id="listEditorName"
            maxlength={80}
            placeholder="Datacenter networks"
            bind:value={name}
            invalid={!!nameError}
            aria-describedby={nameError ? "listEditorName-error" : undefined}
            oninput={() => (nameError = "")}
          />
        </Field>
        {#if !listId}
          <Button type="submit" variant="primary" disabled={savingName}>{savingName ? "Creating" : "Create list"}</Button>
        {:else if name.trim() !== view.name}
          <Button type="submit" disabled={savingName}>{savingName ? "Saving" : "Save name"}</Button>
        {/if}
      </form>

      {#if listId}
        <form class="flex flex-col gap-2.5" onsubmit={addEntries} novalidate>
          <div class="flex items-center justify-between gap-3">
            <label for="listInput" class="text-sm font-medium">Add entries</label>
            <label class="-my-1 -me-2 inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-xs focus-within:ring-2 focus-within:ring-ring text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
              Import file
              <input
                type="file"
                accept=".txt,.csv,.list,.netset,.ipset,text/plain,text/csv"
                class="sr-only"
                onchange={(e) => {
                  importFile(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
          <div
            class="le-drop relative rounded-[10px]"
            data-dragging={dragging || undefined}
            role="presentation"
            ondragenter={(e) => {
              if (e.dataTransfer?.types.includes("Files")) dragging = true;
            }}
            ondragover={(e) => {
              if (!e.dataTransfer?.types.includes("Files")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            ondragleave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) dragging = false;
            }}
            ondrop={(e) => {
              const file = e.dataTransfer?.files?.[0];
              dragging = false;
              if (!file) return;
              e.preventDefault();
              importFile(file);
            }}
          >
            <Textarea
              id="listInput"
              rows={3}
              mono
              placeholder={"One per line, or drop a file\n203.0.113.7\n198.51.100.0/24"}
              bind:value={input}
              invalid={!!inputError}
              aria-describedby="listPreview{inputError ? ' listInput-error' : ''}"
              oninput={() => (inputError = "")}
              onkeydown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div class="le-drop-hint pointer-events-none absolute inset-0 flex items-center justify-center rounded-[10px] border border-dashed border-ring bg-background/85 text-sm font-medium" aria-hidden="true">Drop to add</div>
          </div>
          {#if inputError}<p id="listInput-error" class="text-sm text-destructive" role="alert">{inputError}</p>{/if}
          <div id="listPreview" class="flex flex-col gap-2" role="status">
            {#if parsed.length}
              <div class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                <p class="text-pretty">
                  <span class="text-foreground">{additions.length ? plural(additions.length, "new entry", "new entries") : "Nothing new"}</span>{#if known.length}, {nf.format(known.length)} already on the list{/if}{#if bad.length}, <span class="text-destructive">{nf.format(bad.length)} to fix</span>{/if}
                </p>
                {#if bad.length}
                  <button
                    type="button"
                    class="-my-1 -me-2 ms-auto h-6 cursor-pointer rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    onclick={() => {
                      input = stripLines(input, bad);
                      document.getElementById("listInput")?.focus();
                    }}
                  >
                    Remove {bad.length === 1 ? "it" : `all ${nf.format(bad.length)}`}
                  </button>
                {/if}
              </div>
              {#if summary && additions.length > 1}<p class="-mt-1 text-xs text-pretty text-muted-foreground tabular-nums">{summary}</p>{/if}
              <ul class="flex flex-wrap gap-1.5" aria-label="Detected entries">
                {#each preview as p, i (i)}
                  <li
                    class="le-chip inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs {p.status === 'invalid' || p.status === 'duplicate' ? 'bg-destructive/10 text-destructive' : p.status === 'existing' ? 'bg-muted/50 text-muted-foreground' : 'bg-muted'}"
                    title={p.reason ? `Line ${p.line}: ${p.reason}` : `Line ${p.line}`}
                  >
                    {#if p.kind === "country" && p.status === "new" && !p.reason}<span aria-hidden="true">{countryFlag(p.value)}</span>{/if}
                    <span class="truncate font-mono {p.status === 'existing' ? 'line-through decoration-muted-foreground/50' : ''}">{chipValue(p)}</span>
                    <span class="shrink-0 {p.status === 'new' ? 'text-muted-foreground' : 'opacity-80'}">{p.status === "new" ? (p.reason || (p.kind === "country" ? countryName(p.value) : KIND_LABELS[p.kind])) : p.reason}</span>
                  </li>
                {/each}
                {#if parsed.length > PREVIEW_MAX}
                  <li class="inline-flex h-6 items-center px-1 text-xs text-muted-foreground tabular-nums">and {nf.format(parsed.length - PREVIEW_MAX)} more</li>
                {/if}
              </ul>
            {:else}
              <p class="text-xs text-pretty text-muted-foreground">Paste IPs, ranges, ASNs, country codes or user agents. Start a line with <code class="font-mono">org:</code> for a network name, and end it with <code class="font-mono"># note</code> to label it.</p>
            {/if}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label for="listTtl" class="text-sm text-muted-foreground">Remove after</label>
            <Select id="listTtl" bind:value={ttl} options={TTL_OPTIONS.map(([v, l]) => [String(v), v ? l : "Never"])} />
            <Button type="submit" class="ms-auto tabular-nums" disabled={adding || (parsed.length > 0 && !additions.length)}>{adding ? "Adding" : additions.length ? `Add ${plural(additions.length, "entry", "entries")}` : "Add entries"}</Button>
          </div>
        </form>

        <section class="flex flex-col gap-2" aria-label="Entries">
          <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div class="flex min-w-0 items-center gap-1">
              <h3 class="me-1 text-sm font-medium whitespace-nowrap tabular-nums">{narrowed ? `${nf.format(matching.length)} of ${nf.format(view.items.length)}` : plural(view.items.length, "entry", "entries")}</h3>
              {#if matching.length}
                <button type="button" class="inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-xs text-muted-foreground outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onclick={() => copy(matching.map(asLine).join("\n"))}>Copy</button>
              {/if}
              {#if narrowed && matching.length}
                <button type="button" class="inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-xs text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring" onclick={removeMatching}>Remove {nf.format(matching.length)}</button>
              {/if}
            </div>
            {#if view.items.length > 8 || filter}
              <label for="listFilter" class="sr-only">Filter entries or check an IP</label>
              <div class="w-52 max-w-full">
                <Input id="listFilter" type="search" icon="search" size="sm" placeholder="Filter or check an IP" bind:value={filter} />
              </div>
            {/if}
          </div>
          {#if kinds.length > 1 || unused || counting}
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap gap-1.5" role="group" aria-label="Show entries">
                {#each [["all", view.items.length], ...(kinds.length > 1 ? kinds : []), ...(unused ? [["unused", unused]] : [])] as [k, n] (k)}
                  <button
                    type="button"
                    class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring {kindFilter === k ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'}"
                    aria-pressed={kindFilter === k}
                    title={k === "unused" ? `No traffic in the last ${RANGE_WORDS[hitRange]}` : undefined}
                    onclick={() => (kindFilter = k)}
                  >
                    {k === "all" ? "All" : k === "unused" ? "No hits" : KIND_LABELS[k]}
                    <span class="tabular-nums {kindFilter === k ? 'text-muted-foreground' : 'text-faint-foreground'}">{nf.format(n)}</span>
                  </button>
                {/each}
              </div>
              {#if counting}
                <Segmented
                  size="sm"
                  label="Count hits over"
                  bind:value={hitRange}
                  options={[["24h", "24h"], ["7d", "7d"], ["30d", "30d"]]}
                  onchange={loadHits}
                />
              {/if}
            </div>
          {/if}
          {#if probe}
            <p class="text-sm text-pretty {shown.length ? 'text-foreground' : 'text-muted-foreground'}" role="status">
              {shown.length ? `${filter.trim()} matches ${plural(shown.length, "entry", "entries")} on this list.` : `${filter.trim()} isn't on this list or inside any of its ranges.`}
            </p>
          {/if}
          {#if !view.items.length}
            <p class="text-sm text-muted-foreground">No entries yet, so rules using this list match nothing.</p>
          {:else if !shown.length}
            {#if !probe}<p class="text-sm text-muted-foreground">No entries match "{filter}".</p>{/if}
          {:else}
            <Table class="border-t border-border">
              <TableBody>
                {#each shown as i (keyOf(i))}
                  {@const k = keyOf(i)}
                  <TableRow class="le-row hover:bg-transparent {fresh.has(k) ? 'le-enter' : ''}" data-leaving={leaving.has(k) || undefined}>
                    <TableCell class="max-w-56 ps-0">
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate" title={i.value}>
                          {#if i.kind === "country"}<span class="me-1.5">{countryFlag(i.value)}</span>{/if}<code class="font-mono text-xs">{i.kind === "asn" ? `AS${i.value}` : i.value}</code>
                        </span>
                        <span class="truncate text-xs text-muted-foreground" title={i.note || undefined}>{[i.kind === "country" ? countryName(i.value) || "Country" : (KIND_LABELS[i.kind] ?? i.kind), i.note, hitOf(i) && i.expires ? `ends in ${until(i.expires)}` : ""].filter(Boolean).join(", ")}</span>
                      </span>
                    </TableCell>
                    {@const h = hitOf(i)}
                    <TableCell class="w-px text-end text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {#if h}
                        <span class="flex flex-col items-end" title={h.n ? `${nf.format(h.n)} requests in the last ${RANGE_WORDS[hitRange]}, ${nf.format(h.blocked)} blocked` : `No requests in the last ${RANGE_WORDS[hitRange]}`}>
                          <span class={h.n ? "text-foreground" : "text-faint-foreground"}>{h.n ? `${compact(h.n)} ${h.n === 1 ? "hit" : "hits"}` : "No hits"}</span>
                          {#if h.n}<span>{h.blocked === h.n ? "all blocked" : h.blocked ? `${compact(h.blocked)} blocked` : "none blocked"}</span>{/if}
                        </span>
                      {:else if i.expires}
                        Ends in {until(i.expires)}
                      {:else if i.added}
                        <span title={fullFmt.format(i.added)}>Added {ago(i.added)}</span>
                      {/if}
                    </TableCell>
                    <TableCell class="w-px pe-0 text-end">
                      <Button variant="ghost" size="sm" icon class="-me-2 text-muted-foreground hover:text-foreground focus-visible:text-foreground" aria-label="Remove {i.value}" disabled={leaving.has(k)} onclick={() => removeItem(i)}>
                        <Icon name="x" size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
            {#if matching.length > shown.length}
              <p class="text-sm text-muted-foreground tabular-nums">Showing the first {nf.format(shown.length)}. Filter to find the rest.</p>
            {/if}
          {/if}
        </section>

        {#if !stacked}
        <div class="border-t border-border pt-4">
          <Button variant="danger-ghost" size="sm" class="-ms-2.5" onclick={deleteList}>
            <Icon name="trash" size={14} />
            Delete list
          </Button>
        </div>
        {/if}
      {/if}
    </div>
  </Skeleton>
</Drawer>

<style>
  .le-drop-hint {
    opacity: 0;
  }

  .le-drop[data-dragging] .le-drop-hint {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .le-drop-hint {
      transition: opacity 140ms ease-out;
    }

    :global(.le-row) {
      transition-property: opacity, filter, transform;
      transition-duration: 160ms;
      transition-timing-function: ease-in;
    }

    :global(.le-row[data-leaving]) {
      opacity: 0;
      filter: blur(4px);
      transform: translateX(6px);
    }

  }

</style>
