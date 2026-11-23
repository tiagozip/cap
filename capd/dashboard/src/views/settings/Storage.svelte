<script>
import {
  Button,
  Input,
  Row,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Tag,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { bytes, compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import { toast } from "../../lib/ui.svelte.js";

const RETENTION = [1, 7, 14, 30, 90, 180, 365, 730];
const IP_MODES = {
  full: "Lets you block and look up exact visitors.",
  truncate:
    "Drops the last part of each address. Still enough for country and network.",
  none: "Events can't be traced back to an address.",
};
const ENGINES = {
  duckdb: "DuckDB on this server",
  clickhouse: "ClickHouse database",
  redis: "Totals in Valkey",
  off: "Analytics are off",
};

let status = $state(structuredClone(samples.storage.status));
let loadError = $state("");
let form = $state(structuredClone(samples.storage.form));
let ready = $state(false);
let customRetention = $state(false);
let saving = $state(false);
let error = $state("");

const counters = $derived(status.backend === "redis");
const off = $derived(status.backend === "off");
const usage = $derived(
  off
    ? "Cap doesn't store any events."
    : `${compact(status.info?.events ?? 0)} events${counters ? " counted" : `, ${bytes(status.info?.bytes)}`}.${status.buffered ? ` ${status.buffered} waiting to be written.` : ""}${status.dropped ? ` ${status.dropped} dropped.` : ""}`,
);

const load = async () => {
  const r = await api("GET", "/settings/analytics");
  if (!r?.settings) {
    loadError = r?.error || "Couldn't load storage settings";
    return;
  }
  loadError = "";
  status = r.status;
  const s = r.settings;
  form = {
    retentionDays: s.retentionDays,
    ipMode: s.ipMode,
    logChallenges: !!s.logChallenges,
  };
  customRetention = !RETENTION.includes(s.retentionDays);
  ready = true;
};

load();

const save = async () => {
  error = "";
  const days = Number(form.retentionDays);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    error = "Keep events for between 1 and 3,650 days.";
    document.getElementById("retention-custom")?.focus();
    return;
  }
  saving = true;
  const res = await api("PUT", "/settings/analytics", {
    retentionDays: days,
    ipMode: form.ipMode,
    logChallenges: form.logChallenges,
  });
  saving = false;
  if (!res?.success) {
    error = res?.error || "Couldn't save storage settings";
    return;
  }
  toast("Storage settings saved");
  await load();
};
</script>

<Skeleton loading={!ready && !loadError} error={loadError} label="Loading storage settings">
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{loadError}</p>
  {/snippet}
  <div class="flex flex-col divide-y divide-border">
    <Row label={ENGINES[status.backend] ?? status.backend} help={usage}>
      <div><Tag tone={status.healthy ? "success" : "warning"} dot>{status.healthy ? "Working" : "Having trouble"}</Tag></div>
      {#snippet below()}
        {#if status.backend === "duckdb"}
          <p class="text-sm text-pretty text-muted-foreground">Events are stored in a file inside this container, so each Cap container keeps its own history. ClickHouse keeps one history for all of them. Start Cap with <code class="text-[0.9em]">CLICKHOUSE_URL</code> set to use it.</p>
        {:else if counters}
          <p class="text-sm text-pretty text-muted-foreground">Cap counts challenges, solves, failures, blocks and rate limits per hour, and every Cap container shares the same totals. It doesn't keep single events, so the event list, locations, networks and insights stay empty. Start Cap with <code class="text-[0.9em]">ANALYTICS=duckdb</code> or <code class="text-[0.9em]">CLICKHOUSE_URL</code> to record them.</p>
        {:else if off}
          <p class="text-sm text-pretty text-muted-foreground">Cap was started with <code class="text-[0.9em]">ANALYTICS=off</code>. Verification, rules and webhooks still work. Remove it to record events again.</p>
        {/if}
        {#if status.configured === "clickhouse" && status.backend !== "clickhouse"}
          <p class="text-sm text-destructive md:text-end" role="alert">Couldn't reach ClickHouse, so Cap is storing events in DuckDB for now.</p>
        {/if}
        {#if status.lastError}
          <p class="text-sm text-destructive md:text-end" role="alert">{status.lastError}</p>
        {/if}
      {/snippet}
    </Row>

    {#if !off}
      <Row label="Keep events for" for="retention" help="Cap deletes older events on its own.">
        <div class="flex flex-wrap items-center gap-2 md:justify-end">
          {#if customRetention}
            <label for="retention-custom" class="sr-only">Days to keep events</label>
            <Input
              id="retention-custom"
              class="max-w-24"
              type="number"
              inputmode="numeric"
              min="1"
              max="3650"
              bind:value={form.retentionDays}
              invalid={!!error}
            />
            <span class="text-sm text-muted-foreground">days</span>
          {/if}
          <Select
            id="retention"
            options={[...RETENTION.map((d) => [String(d), d === 1 ? "1 day" : d === 365 ? "1 year" : d === 730 ? "2 years" : `${d} days`]), ["other", "Other"]]}
            bind:value={
              () => (customRetention ? "other" : String(form.retentionDays)),
              (v) => {
                customRetention = v === "other";
                if (!customRetention) form.retentionDays = Number(v);
              }
            }
          />
        </div>
      </Row>

      {#if !counters}
        <Row label="Visitor IP addresses" help={IP_MODES[form.ipMode]}>
          <Segmented
            class="self-start md:self-auto"
            label="Visitor IP addresses"
            bind:value={form.ipMode}
            options={[
              ["full", "Full"],
              ["truncate", "Shortened"],
              ["none", "Don't keep"],
            ]}
          />
        </Row>
      {/if}

      <Row label="Record every challenge shown" for="log-challenges" help="When off, Cap keeps solves, blocks and rate limits only. That's about a third fewer events.">
        <Switch id="log-challenges" bind:checked={form.logChallenges} />
      </Row>

      <div class="flex flex-wrap items-center justify-end gap-3 py-5">
        {#if error}
          <p class="me-auto text-sm text-destructive" role="alert">{error}</p>
        {/if}
        <Button variant="primary" disabled={saving} onclick={save}>{saving ? "Saving" : "Save storage settings"}</Button>
      </div>
    {/if}
  </div>
</Skeleton>
