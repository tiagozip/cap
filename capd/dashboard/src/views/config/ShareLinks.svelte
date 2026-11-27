<script>
import {
  Button,
  Dialog,
  Empty,
  Field,
  Group,
  Icon,
  Input,
  Select,
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
import { api, url } from "../../lib/api.js";
import { ago, fullFmt, until } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { app } from "../../lib/state.svelte.js";
import { undoable } from "../../lib/ui.svelte.js";
import RevealedValue from "../../polish/config-misc/RevealedValue.svelte";

const sk = app.key.siteKey;

let shares = $state(null);
let loadError = $state("");
let creating = $state(false);
let label = $state("");
let expiresIn = $state("0");
let submitting = $state(false);
let createError = $state("");
let created = $state(null);
let showCreated = $state(false);
let stale = $state(false);

async function load() {
  const data = await api("GET", `/keys/${sk}/shares`);
  if (!Array.isArray(data)) {
    loadError = data?.error || "Couldn't load share links";
    shares = [];
    return;
  }
  loadError = "";
  shares = data;
}

load();

async function submit() {
  submitting = true;
  createError = "";
  const res = await api("POST", `/keys/${sk}/shares`, {
    name: label.trim() || undefined,
    expiresIn: Number(expiresIn) || undefined,
  });
  submitting = false;
  if (!res?.token) {
    createError = res?.error || "Couldn't create the link. Try again.";
    return;
  }
  creating = false;
  label = "";
  expiresIn = "0";
  created = `${url("share")}#${res.token}`;
  showCreated = true;
  stale = true;
}

$effect(() => {
  if (showCreated || !stale) return;
  stale = false;
  load();
});

function revoke(share) {
  const at = shares.indexOf(share);
  shares = shares.filter((x) => x.id !== share.id);
  undoable({
    message: "Share link revoked",
    commit: async () => {
      const res = await api("DELETE", `/keys/${sk}/shares/${share.id}`);
      return res?.error ? res.error : null;
    },
    undo: () => {
      shares = shares.toSpliced(at, 0, share);
    },
  });
}
</script>

<Group
  id="cfgShares"
  title="Share links"
  flush={!!shares?.length}
>
  {#snippet action()}
    <Button
      size="sm"
      onclick={() => {
        createError = "";
        creating = true;
      }}
    >
      <Icon name="plus" size={14} />
      Create link
    </Button>
  {/snippet}
  <Skeleton data={shares} sample={samples.shares} error={loadError} empty={shares?.length === 0} label="Loading share links">
    {#snippet errorMessage()}
      <p class="py-4 text-sm text-destructive" role="alert">{loadError}</p>
    {/snippet}
    {#snippet emptyMessage()}
      <Empty>
        No share links yet. Create one to show this key's stats to someone without an account.
      </Empty>
    {/snippet}
    {#snippet children(rows)}
      <Table flush>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead class="max-sm:hidden">Created</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead class="w-0"><span class="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each rows as share (share.id)}
            <TableRow>
              <TableCell class="max-w-64 truncate font-medium max-sm:max-w-40">
                {#if share.name}{share.name}{:else}<span class="text-muted-foreground">Untitled link</span>{/if}
              </TableCell>
              <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums max-sm:hidden">
                <span title={fullFmt.format(new Date(share.created))}>{ago(share.created)}</span>
              </TableCell>
              <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">
                {#if share.expires}
                  <span class={share.expires - Date.now() < 259_200_000 ? "text-warning" : ""} title={fullFmt.format(new Date(share.expires))}>In {until(share.expires)}</span>
                {:else}
                  Never
                {/if}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Revoke {share.name || 'untitled link'}"
                  onclick={() => revoke(share)}
                >
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
    </Table>
    {/snippet}
  </Skeleton>
</Group>

<Dialog bind:open={creating} title="Create share link">
  <form
    id="shareForm"
    class="flex flex-col gap-4"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    <Field label="Name" for="shareName" optional>
      <Input id="shareName" type="text" maxlength="64" autocomplete="off" placeholder="Marketing team" bind:value={label} />
    </Field>
    <Field label="Expires" for="shareExpiry">
      <Select
        id="shareExpiry"
        class="w-full"
        options={[
          ["0", "Never"],
          ["604800", "In 7 days"],
          ["2592000", "In 30 days"],
          ["7776000", "In 90 days"],
        ]}
        bind:value={expiresIn}
      />
    </Field>
    {#if createError}<p class="text-sm text-destructive" role="alert">{createError}</p>{/if}
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (creating = false)}>Cancel</Button>
    <Button type="submit" form="shareForm" variant="primary" disabled={submitting}>
      {submitting ? "Creating" : "Create link"}
    </Button>
  {/snippet}
</Dialog>

<Dialog
  bind:open={showCreated}
  guard
  title="Share link created"
  description="Copy it now, Cap won't show it again. Anyone with it can see this key's stats."
>
  <RevealedValue value={created ?? ""} label="Copy link" />
  {#snippet footer()}
    <Button variant="primary" onclick={() => (showCreated = false)}>Done</Button>
  {/snippet}
</Dialog>
