<script>
import {
  Button,
  Input,
  Row,
  Segmented,
  Select,
  Skeleton,
  Switch,
} from "../../components/cap/index.js";
import Odometer from "../../components/cap/Odometer.svelte";
import { api } from "../../lib/api.js";
import { bytes, compact } from "../../lib/format.js";
import { samples } from "../../lib/samples.js";
import SaveBar from "../../polish/instance-settings/SaveBar.svelte";
import Health from "../../polish/settings-c/Health.svelte";

const RETENTION = [1, 7, 14, 30, 90, 180, 365, 730];
const IP_MODES = {
  full: "Exact addresses, so you can block and look up visitors.",
  truncate: "Drops the last part. Still enough for country and network.",
  none: "No addresses stored.",
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
let stored = $state(structuredClone(samples.storage.form));
let ready = $state(false);
let customRetention = $state(false);
let saving = $state(false);
let error = $state("");

const counters = $derived(status.backend === "redis");
const off = $derived(status.backend === "off");
const events = $derived(status.info?.events ?? 0);
const size = $derived.by(() => {
  const [num, unit = ""] = bytes(status.info?.bytes ?? 0).split(" ");
  const decimals = num.split(".")[1]?.length ?? 0;
  return [Number(num), unit, decimals];
});
const health = $derived(
  off ? "off" : status.healthy && !status.lastError ? "ok" : "warn",
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
  stored = { ...form };
  customRetention = !RETENTION.includes(s.retentionDays);
  ready = true;
};

load();

$effect(() => {
  if (!ready || off) return;
  const timer = setInterval(async () => {
    if (document.hidden) return;
    const r = await api("GET", "/settings/analytics");
    if (r?.status) status = r.status;
  }, 20_000);
  return () => clearInterval(timer);
});

const dirty = $derived(
  Number(form.retentionDays) !== stored.retentionDays ||
    form.ipMode !== stored.ipMode ||
    form.logChallenges !== stored.logChallenges,
);

const discard = () => {
  error = "";
  form = { ...stored };
  customRetention = !RETENTION.includes(stored.retentionDays);
};

const save = async () => {
  error = "";
  const days = Number(form.retentionDays);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    error = "Keep events for between 1 and 3,650 days.";
    document.getElementById("retention-custom")?.focus();
    return false;
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
    return false;
  }
  await load();
};
</script>

<Skeleton loading={!ready && !loadError} error={loadError} label="Loading storage settings">
  {#snippet errorMessage()}
    <p class="py-5 text-sm text-destructive" role="alert">{loadError}</p>
  {/snippet}
  <div class="flex flex-col divide-y divide-border">
    <div class="grid items-start gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12">
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-sm font-medium">{ENGINES[status.backend] ?? status.backend}</p>
        {#if off}
          <p class="text-sm text-pretty text-muted-foreground">Cap doesn't store any events.</p>
        {:else}
          <p class="text-sm text-pretty text-muted-foreground tabular-nums">
            <Odometer class="text-foreground" value={events} format={compact} /> events{counters ? " counted" : ""}{#if !counters}, <Odometer class="text-foreground" value={size[0]} format={(v) => v.toFixed(size[2])} /> {size[1]} on disk{/if}{#if status.buffered}, <Odometer class="text-foreground" value={status.buffered} format={compact} /> waiting to be written{/if}{#if status.dropped}, <span class="text-destructive"><Odometer value={status.dropped} format={compact} /> dropped</span>{/if}
          </p>
        {/if}
      </div>
      <div class="flex min-w-0 flex-col gap-3 md:items-end">
        <Health tone={health} class="min-h-6">{off ? "Off" : health === "ok" ? "Working" : "Having trouble"}</Health>
        {#if status.configured === "clickhouse" && status.backend !== "clickhouse"}
          <p class="text-sm text-destructive md:text-end" role="alert">Couldn't reach ClickHouse, so Cap is storing events in DuckDB for now.</p>
        {/if}
        {#if status.lastError}
          <p class="text-sm text-destructive md:text-end" role="alert">{status.lastError}</p>
        {/if}
      </div>
      {#if status.backend === "duckdb" || counters || off}
        <p class="text-sm text-pretty text-muted-foreground md:col-span-2">
          {#if status.backend === "duckdb"}
            Each container keeps its own history. Set <code class="text-[0.9em]">CLICKHOUSE_URL</code> to share one.
          {:else if counters}
            Hourly totals only, so events, locations and insights stay empty. Set <code class="text-[0.9em]">ANALYTICS=duckdb</code> or <code class="text-[0.9em]">CLICKHOUSE_URL</code> to record them.
          {:else}
            <code class="text-[0.9em]">ANALYTICS=off</code> is set. Verification, rules and webhooks still work.
          {/if}
        </p>
      {/if}
    </div>

    {#if !off}
      <Row label="Keep events for" for="retention">
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
        {#snippet below()}
          {#if Number(form.retentionDays) >= 1 && Number(form.retentionDays) < stored.retentionDays}
            <p class="text-sm text-pretty text-warning md:text-end" role="status">Saving deletes events older than {Number(form.retentionDays) === 1 ? "1 day" : `${Number(form.retentionDays)} days`}.</p>
          {/if}
        {/snippet}
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

      <Row label="Record every challenge shown" for="log-challenges" help="When off, only solves, blocks and rate limits are kept. About a third fewer events.">
        <Switch id="log-challenges" bind:checked={form.logChallenges} />
      </Row>

      <SaveBar {dirty} {saving} {error} label="Save storage settings" onsave={save} ondiscard={discard} />
    {/if}
  </div>
</Skeleton>
