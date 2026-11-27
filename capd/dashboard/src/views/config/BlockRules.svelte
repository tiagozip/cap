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
  Tag,
  Textarea,
} from "../../components/cap/index.js";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/index.js";
import { api } from "../../lib/api.js";
import { fullFmt, until } from "../../lib/format.js";
import { countryFlagEmoji, countryName } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import { app } from "../../lib/state.svelte.js";
import { toast, undoable } from "../../lib/ui.svelte.js";
import { parseTargets } from "../../polish/key-settings/target.js";

const sk = app.key.siteKey;
const TYPES = {
  ip: "IP address",
  cidr: "IP range",
  asn: "Network (ASN)",
  country: "Country",
};
const keyOf = (item) => `${item.type}:${item.ip}`;

let items = $state(null);
let loadError = $state("");
let adding = $state(false);
let value = $state("");
let duration = $state("0");
let submitting = $state(false);
let addError = $state("");

async function load() {
  const data = await api("GET", `/keys/${sk}/blocked-ips`);
  if (!Array.isArray(data)) {
    loadError = data?.error || "Couldn't load blocked visitors";
    items = [];
    return;
  }
  loadError = "";
  items = data;
}

load();

function remove(item) {
  const at = items.findIndex((x) => keyOf(x) === keyOf(item));
  items = items.filter((x) => keyOf(x) !== keyOf(item));
  undoable({
    message: `Unblocked ${item.type === "country" ? countryName(item.ip) : item.ip}`,
    commit: async () => {
      const res = await api("POST", `/keys/${sk}/unblock-ip`, {
        type: item.type || "ip",
        value: item.ip,
      });
      return res?.error ? res.error : null;
    },
    undo: () => {
      items = items.toSpliced(at, 0, item);
    },
  });
}

const targets = $derived(parseTargets(value));
const bad = $derived(targets.filter((t) => t.type === "bad"));

async function submit() {
  if (submitting) return;
  if (!targets.length || bad.length) {
    addError = targets.length
      ? `${bad.map((t) => t.text).join(", ")} isn't an IP, range, network or country.`
      : "Enter what to block.";
    document.getElementById("blockRuleValue")?.focus();
    return;
  }
  addError = "";
  submitting = true;
  const failed = [];
  for (const t of targets) {
    const res = await api("POST", `/keys/${sk}/block-ip`, {
      type: t.type,
      value: t.value,
      duration: Number(duration),
    });
    if (!res?.success) failed.push([t, res?.error]);
  }
  submitting = false;
  const done = targets.length - failed.length;
  if (done) await load();
  if (failed.length) {
    value = failed.map(([t]) => t.text).join("\n");
    addError =
      failed[0][1] && failed[0][1] !== "Invalid value"
        ? failed[0][1]
        : `Couldn't block ${failed.map(([t]) => t.text).join(", ")}.`;
    if (done) toast(`Blocked ${done} of ${targets.length}`);
    return;
  }
  adding = false;
  value = "";
  toast(done === 1 ? "Block rule added" : `${done} block rules added`);
}
</script>

<Group
  id="cfgBlocked"
  title="Blocked networks"
  flush={!!items?.length}
>
  {#snippet action()}
    <Button
      size="sm"
      onclick={() => {
        addError = "";
        adding = true;
      }}
    >
      <Icon name="plus" size={14} />
      Block a network
    </Button>
  {/snippet}
  <Skeleton data={items} sample={samples.blocked} error={loadError} empty={items?.length === 0} label="Loading blocked networks">
    {#snippet errorMessage()}
      <p class="py-4 text-sm text-destructive" role="alert">{loadError}</p>
    {/snippet}
    {#snippet emptyMessage()}
      <Empty>Nobody is blocked yet.</Empty>
    {/snippet}
    {#snippet children(rows)}
      <Table flush>
        <TableHeader>
          <TableRow>
            <TableHead>Blocked</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead class="w-0"><span class="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each rows as item (keyOf(item))}
            <TableRow>
              <TableCell class="font-medium">
                {#if item.type === "country"}
                  {countryFlagEmoji(item.ip)} {countryName(item.ip)}
                {:else}
                  <span class="font-mono text-sm">{item.ip}</span>
                {/if}
              </TableCell>
              <TableCell><Tag>{TYPES[item.type] ?? item.type}</Tag></TableCell>
              <TableCell class="whitespace-nowrap text-muted-foreground tabular-nums">
                {#if item.permanent}
                  Never
                {:else}
                  <span title={fullFmt.format(new Date(item.expires))}>In {until(item.expires)}</span>
                {/if}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Unblock {item.type === 'country' ? countryName(item.ip) : item.ip}"
                  onclick={() => remove(item)}
                >
                  Unblock
                </Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
    </Table>
    {/snippet}
  </Skeleton>
</Group>

<Dialog bind:open={adding} title="Block a network" description="IP addresses, ranges, ASNs, network names or countries. Add several on separate lines.">
  <form
    id="blockRuleForm"
    class="flex flex-col gap-4"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    <Field label="Block" for="blockRuleValue" error={addError}>
      <Textarea
        id="blockRuleValue"
        rows="3"
        autocomplete="off"
        spellcheck="false"
        mono
        placeholder={"203.0.113.7\n10.0.0.0/8\nAS15169\nGermany"}
        bind:value
        invalid={!!addError}
        aria-describedby={addError ? "blockRuleValue-error" : "blockRulePreview"}
        oninput={() => (addError = "")}
        onkeydown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
    </Field>
    {#if targets.length}
      <ul id="blockRulePreview" class="-mt-1 flex flex-col gap-1.5 text-sm" aria-label="Will block">
        {#each targets as t (`${t.type}:${t.value}`)}
          <li class="grid min-w-0 grid-cols-[7.25rem_minmax(0,1fr)_auto] items-center gap-2.5 [&>[data-slot=badge]]:justify-self-start">
            {#if t.type === "bad"}
              <Tag tone="danger">Not recognised</Tag>
              <span class="min-w-0 truncate font-mono text-destructive">{t.text}</span>
            {:else}
              <Tag>{TYPES[t.type]}</Tag>
              {#if t.type === "country" || t.detail === "By name"}
                <span class="min-w-0 truncate">{t.type === "country" ? `${countryFlagEmoji(t.value)} ${countryName(t.value)}` : t.value}</span>
              {:else}
                <span class="min-w-0 truncate font-mono">{t.value}</span>
              {/if}
              {#if t.detail}<span class="shrink-0 text-muted-foreground tabular-nums">{t.detail}</span>{/if}
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <Field label="For how long" for="blockRuleDuration">
      <Select
        id="blockRuleDuration"
        class="w-full"
        options={[
          ["0", "Until I remove it"],
          ["3600", "1 hour"],
          ["86400", "24 hours"],
          ["604800", "7 days"],
          ["2592000", "30 days"],
        ]}
        bind:value={duration}
      />
    </Field>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (adding = false)}>Cancel</Button>
    <Button type="submit" form="blockRuleForm" variant="danger" disabled={submitting} aria-busy={submitting}>
      {submitting ? "Blocking" : targets.length - bad.length > 1 ? `Block ${targets.length - bad.length}` : "Block"}
    </Button>
  {/snippet}
</Dialog>
