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
import { countryFlagEmoji, countryName, countryNames } from "../../lib/geo.js";
import { samples } from "../../lib/samples.js";
import { app } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";

const sk = app.key.siteKey;
const TYPES = {
  ip: "IP address",
  cidr: "IP range",
  asn: "Network (ASN)",
  country: "Country",
};
const NOUNS = { ip: "IP address", cidr: "IP range", asn: "network" };
const PLACEHOLDERS = { ip: "1.2.3.4", cidr: "10.0.0.0/8", asn: "AS15169" };
const countries = Object.entries(countryNames).sort((a, b) =>
  a[1].localeCompare(b[1]),
);

let items = $state(null);
let loadError = $state("");
let removing = $state(null);
let adding = $state(false);
let type = $state("ip");
let value = $state("");
let country = $state("");
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

async function remove(item) {
  removing = `${item.type}:${item.ip}`;
  const res = await api("POST", `/keys/${sk}/unblock-ip`, {
    type: item.type || "ip",
    value: item.ip,
  });
  removing = null;
  if (res?.error) toast(res.error, "error");
  await load();
}

async function submit() {
  const v = type === "country" ? country : value.trim();
  if (!v) {
    addError =
      type === "country"
        ? "Choose a country to block."
        : `Enter the ${NOUNS[type]} to block.`;
    document
      .getElementById(
        type === "country" ? "blockRuleCountry" : "blockRuleValue",
      )
      ?.focus();
    return;
  }
  addError = "";
  submitting = true;
  const res = await api("POST", `/keys/${sk}/block-ip`, {
    type,
    value: v,
    duration: Number(duration),
  });
  submitting = false;
  if (!res?.success) {
    addError =
      res?.error === "Invalid value"
        ? `That doesn't look like a valid ${NOUNS[type]}.`
        : res?.error || "Couldn't add the rule. Try again.";
    return;
  }
  adding = false;
  value = "";
  country = "";
  toast("Block rule added");
  await load();
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
      <Empty>Nobody is blocked. Block an IP address, range, network or country to stop it from solving.</Empty>
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
          {#each rows as item (`${item.type}:${item.ip}`)}
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
                  disabled={removing === `${item.type}:${item.ip}`}
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

<Dialog bind:open={adding} title="Block a network" description="Visitors from it can't solve challenges for this key.">
  <form
    id="blockRuleForm"
    class="flex flex-col gap-4"
    novalidate
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    <Field label="What to block" for="blockRuleType">
      <Select
        id="blockRuleType"
        class="w-full"
        options={Object.entries(TYPES)}
        bind:value={type}
        onchange={() => (addError = "")}
      />
    </Field>
    {#if type === "country"}
      <Field label="Country" for="blockRuleCountry" error={addError}>
        <Select
          id="blockRuleCountry"
          class="w-full"
          options={[["", "Choose a country"], ...countries.map(([code, name]) => [code, `${countryFlagEmoji(code)} ${name}`])]}
          bind:value={country}
          aria-invalid={addError ? "true" : undefined}
          aria-describedby={addError ? "blockRuleCountry-error" : undefined}
        />
      </Field>
    {:else}
      <Field label={type === "asn" ? "ASN number or name" : TYPES[type]} for="blockRuleValue" error={addError}>
        <Input
          id="blockRuleValue"
          type="text"
          autocomplete="off"
          spellcheck="false"
          mono
          placeholder={PLACEHOLDERS[type]}
          bind:value
          invalid={!!addError}
          aria-describedby={addError ? "blockRuleValue-error" : undefined}
        />
      </Field>
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
    <Button type="submit" form="blockRuleForm" variant="danger" disabled={submitting}>
      {submitting ? "Blocking" : "Block network"}
    </Button>
  {/snippet}
</Dialog>
