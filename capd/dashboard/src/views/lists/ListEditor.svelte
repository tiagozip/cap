<script>
import { untrack } from "svelte";
import {
  Button,
  Drawer,
  Empty,
  Field,
  Icon,
  Input,
  Select,
  Skeleton,
  Table,
  Textarea,
} from "../../components/cap/index.js";
import { TableBody, TableCell, TableRow } from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { until } from "../../lib/format.js";
import { numFmt, t, tp } from "../../lib/i18n.svelte.js";
import { samples } from "../../lib/samples.js";
import { confirm, toast } from "../../lib/ui.svelte.js";
import { countryFlag, TTL_OPTIONS } from "../events/labels.js";

let { id = null, usedBy = null, stacked = false, onclose, onchange } = $props();

const PREVIEW_MAX = 12;

const KIND_LABELS = $derived({
  ip: t("IP"),
  cidr: t("IP range"),
  asn: t("ASN"),
  org: t("Network name"),
  country: t("Country"),
  ua: t("User agent"),
  visitor: t("Visitor"),
});
const COUNT_LABELS = {
  ip: ["{count} IP", "{count} IPs"],
  cidr: ["{count} IP range", "{count} IP ranges"],
  asn: ["{count} ASN", "{count} ASNs"],
  org: ["{count} network name", "{count} network names"],
  country: ["{count} country", "{count} countries"],
  ua: ["{count} user agent", "{count} user agents"],
  visitor: ["{count} visitor", "{count} visitors"],
};

const guessKind = (raw) => {
  const v = raw.trim();
  const m = v.match(/^(ip|cidr|asn|org|country|ua|visitor):(.+)$/i);
  if (m) return { kind: m[1].toLowerCase(), value: m[2].trim() };
  if (/^[\d.]+\/\d+$|^[0-9a-f:]+\/\d+$/i.test(v))
    return { kind: "cidr", value: v };
  if (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(v) ||
    (/^[0-9a-f:]+$/i.test(v) && v.includes(":"))
  )
    return { kind: "ip", value: v };
  if (/^AS\d+$/i.test(v)) return { kind: "asn", value: v };
  if (/^[A-Za-z]{2}$/.test(v))
    return { kind: "country", value: v.toUpperCase() };
  if (/^[0-9a-f]{16}$/.test(v)) return { kind: "visitor", value: v };
  return { kind: "ua", value: v };
};

const plural = (n, one, many) => tp(n, one, many, { count: numFmt(n) });

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
let filter = $state("");

const parsed = $derived(
  input
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(guessKind),
);
const summary = $derived.by(() => {
  const byKind = {};
  for (const p of parsed) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
  return Object.entries(byKind)
    .map(([k, n]) => plural(n, ...COUNT_LABELS[k]))
    .join(t(", "));
});
const view = $derived(list ?? samples.list);
const shown = $derived.by(() => {
  const items = view.items;
  const q = filter.trim().toLowerCase();
  const hits = q
    ? items.filter((i) =>
        `${i.value} ${KIND_LABELS[i.kind] ?? i.kind} ${i.note}`
          .toLowerCase()
          .includes(q),
      )
    : items;
  return hits.slice(0, 2000);
});

async function load() {
  const detail = await api("GET", `/lists/${listId}`);
  list = detail?.id ? detail : null;
  name = list?.name ?? "";
  loading = false;
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
  toast(t("List renamed"));
  onchange?.(list);
}

async function addEntries(e) {
  e.preventDefault();
  if (!parsed.length) {
    inputError = "Paste at least one entry.";
    document.getElementById("listInput")?.focus();
    return;
  }
  adding = true;
  const res = await api("POST", `/lists/${listId}/items`, {
    items: parsed.map((p) => ({ ...p, ttl: Number(ttl) })),
  });
  adding = false;
  if (!res.success) {
    toast(t(res.error || "Couldn't add entries"), "error");
    return;
  }
  const skipped = res.rejected?.length ?? 0;
  toast(
    skipped
      ? t("Added {added}, skipped {skipped} invalid", {
          added: res.added,
          skipped,
        })
      : t("Added {added}", { added: res.added }),
    skipped ? "error" : "ok",
  );
  input = "";
  await load();
  onchange?.(list);
}

async function removeItem(item) {
  const res = await api("DELETE", `/lists/${listId}/items`, {
    items: [{ kind: item.kind, value: item.value }],
  });
  if (!res.success) {
    toast(t(res.error || "Couldn't remove the entry"), "error");
    return;
  }
  list.items = list.items.filter((i) => i !== item);
  onchange?.(list);
}

async function deleteList() {
  const ok = await confirm({
    title: t("Delete {name}?", { name: list.name }),
    message: usedBy?.length
      ? t(
          "Rules on {keys} check this list. They stop matching once it's gone.",
          { keys: usedBy.join(", ") },
        )
      : t("No rule checks this list, so nothing else changes."),
    confirmText: t("Delete list"),
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", `/lists/${listId}`);
  if (!res.success) {
    toast(t(res.error || "Couldn't delete the list"), "error");
    return;
  }
  toast(t("List deleted"));
  onchange?.(null);
  close();
}
</script>

<Drawer
  bind:open
  {stacked}
  title={listId ? (list?.name ?? t("List")) : t("New shared list")}
  description={listId ? t("Shared list") : t("Shared by every site key")}
  onclose={close}
>
  <Skeleton {loading} empty={!!listId && !list} label={t("Loading list")}>
    {#snippet emptyMessage()}
      <Empty title={t("This list no longer exists")}>{t("Someone deleted it. Close this and pick another list.")}</Empty>
    {/snippet}
    <div class="flex flex-col gap-6">
      {#if listId && usedBy}
        <p class="text-sm text-pretty text-muted-foreground">
          {usedBy.length ? t("Rules on {keys} check this list.", { keys: usedBy.join(", ") }) : t('No rule checks this list yet. Pick it in a rule\'s "is on list" condition to use it.')}
        </p>
      {/if}
      <form class="flex items-end gap-2" onsubmit={saveName} novalidate>
        <Field label={t("Name")} for="listEditorName" error={t(nameError)} class="min-w-0 flex-1">
          <Input
            id="listEditorName"
            maxlength={80}
            placeholder={t("Datacenter networks")}
            bind:value={name}
            invalid={!!nameError}
            aria-describedby={nameError ? "listEditorName-error" : undefined}
            oninput={() => (nameError = "")}
          />
        </Field>
        {#if !listId}
          <Button type="submit" variant="primary" disabled={savingName}>{savingName ? t("Creating") : t("Create list")}</Button>
        {:else if name.trim() !== view.name}
          <Button type="submit" disabled={savingName}>{savingName ? t("Saving") : t("Save name")}</Button>
        {/if}
      </form>

      {#if listId}
        <form class="flex flex-col gap-2.5" onsubmit={addEntries} novalidate>
          <label for="listInput" class="text-sm font-medium">{t("Add entries")}</label>
          <Textarea
            id="listInput"
            rows={3}
            mono
            placeholder={`${t("One per line")}\n203.0.113.7\n198.51.100.0/24`}
            bind:value={input}
            invalid={!!inputError}
            aria-describedby="listPreview{inputError ? ' listInput-error' : ''}"
            oninput={() => (inputError = "")}
          />
          {#if inputError}<p id="listInput-error" class="text-sm text-destructive" role="alert">{t(inputError)}</p>{/if}
          <div id="listPreview" class="flex flex-col gap-2" role="status">
            {#if parsed.length}
              <p class="text-xs text-muted-foreground tabular-nums">{plural(parsed.length, "{count} entry", "{count} entries")}: {summary}</p>
              <ul class="flex flex-wrap gap-1.5" aria-label={t("Detected types")}>
                {#each parsed.slice(0, PREVIEW_MAX) as p, i (i)}
                  <li class="inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 text-xs">
                    <span class="truncate font-mono">{p.value}</span>
                    <span class="shrink-0 text-muted-foreground">{KIND_LABELS[p.kind]}</span>
                  </li>
                {/each}
                {#if parsed.length > PREVIEW_MAX}
                  <li class="inline-flex h-6 items-center px-1 text-xs text-muted-foreground tabular-nums">{t("and {count} more", { count: numFmt(parsed.length - PREVIEW_MAX) })}</li>
                {/if}
              </ul>
            {:else}
              <p class="text-xs text-pretty text-muted-foreground">{t("Cap works out what each line is. Start a line with ip:, cidr:, asn:, org:, country:, ua: or visitor: to pick it yourself.")}</p>
            {/if}
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <label for="listTtl" class="text-sm text-muted-foreground">{t("Remove after")}</label>
            <Select id="listTtl" size="sm" bind:value={ttl} options={TTL_OPTIONS.map(([v, l]) => [String(v), t(v ? l : "Never")])} />
            <Button type="submit" class="ms-auto" disabled={adding}>{adding ? t("Adding") : t("Add entries")}</Button>
          </div>
        </form>

        <section class="flex flex-col gap-2" aria-label={t("Entries")}>
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-medium tabular-nums">{plural(view.items.length, "{count} entry", "{count} entries")}</h3>
            {#if view.items.length > 8}
              <label for="listFilter" class="sr-only">{t("Filter entries")}</label>
              <Input id="listFilter" type="search" icon="search" size="sm" placeholder={t("Filter")} class="w-44" bind:value={filter} />
            {/if}
          </div>
          {#if !view.items.length}
            <p class="text-sm text-muted-foreground">{t("Empty for now. Rules that check it match nothing until you add entries.")}</p>
          {:else if !shown.length}
            <p class="text-sm text-muted-foreground">{t('No entries match "{query}".', { query: filter })}</p>
          {:else}
            <Table class="border-t border-border">
              <TableBody>
                {#each shown as i (`${i.kind}:${i.value}`)}
                  <TableRow>
                    <TableCell class="max-w-56">
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate" title={i.value}>
                          {#if i.kind === "country"}<span class="me-1.5">{countryFlag(i.value)}</span>{/if}<code class="font-mono text-xs">{i.kind === "asn" ? `AS${i.value}` : i.value}</code>
                        </span>
                        <span class="truncate text-xs text-muted-foreground" title={i.note || undefined}>{[KIND_LABELS[i.kind] ?? i.kind, i.note].filter(Boolean).join(", ")}</span>
                      </span>
                    </TableCell>
                    <TableCell class="w-px whitespace-nowrap text-xs text-muted-foreground tabular-nums">{#if i.expires}{t("Ends in {time}", { time: until(i.expires) })}{/if}</TableCell>
                    <TableCell class="w-px text-end">
                      <Button variant="ghost" size="sm" icon aria-label={t("Remove {value}", { value: i.value })} onclick={() => removeItem(i)}>
                        <Icon name="x" size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          {/if}
        </section>

        {#if !stacked}
        <div class="border-t border-border pt-4">
          <Button variant="danger-ghost" size="sm" onclick={deleteList}>
            <Icon name="trash" size={14} />
            {t("Delete list")}
          </Button>
        </div>
        {/if}
      {/if}
    </div>
  </Skeleton>
</Drawer>
