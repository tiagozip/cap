<script>
import {
  Button,
  Field,
  Input,
  Row,
  Select,
  Skeleton,
  Spinner,
  Switch,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { ago, bytes } from "../../lib/format.js";
import { refreshSettings } from "../../lib/state.svelte.js";
import { confirm } from "../../lib/ui.svelte.js";
import Health from "../../polish/settings-c/Health.svelte";

const PROVIDERS = {
  dbip: ["DB-IP Lite", "Free, no account needed."],
  maxmind: [
    "MaxMind GeoLite2",
    "Free, needs a MaxMind account and license key.",
  ],
  ipinfo: ["IPInfo", "Needs an IPInfo token."],
};

let data = $state(null);
let loadError = $state("");
let actionError = $state("");
let progress = $state(null);
let starting = $state(false);
let updateOpen = $state(false);
let provider = $state("dbip");
let accountId = $state("");
let licenseKey = $state("");
let token = $state("");
let cities = $state(false);
let timer = null;

const active = $derived(!!data?.mode);
const mode = $derived(updateOpen ? data.mode : provider);
const serverError = $derived(data?.error || data?.progress?.error || "");
const percent = $derived(
  progress?.total > 0
    ? Math.round((progress.downloaded / progress.total) * 100)
    : null,
);

const load = async () => {
  const r = await api("GET", "/settings/ipdb");
  if (r?.mode === undefined) {
    loadError = r?.error || "Couldn't load the location database status";
    return;
  }
  loadError = "";
  data = r;
  accountId = r.maxmindAccountId || accountId;
  cities = !!r.cities;
  if (r.progress?.active && !timer) watch();
};

const watch = () => {
  clearInterval(timer);
  progress = progress ?? { active: true, file: "", downloaded: 0, total: 0 };
  const tick = async () => {
    const p = await api("GET", "/settings/ipdb/progress");
    if (p?.active) {
      progress = p;
      return;
    }
    clearInterval(timer);
    timer = null;
    progress = null;
    await load();
    await refreshSettings();
  };
  tick();
  timer = setInterval(tick, 500);
};

$effect(() => () => clearInterval(timer));

load();

const start = async () => {
  actionError = "";
  const body = { mode, cities };
  if (mode === "maxmind") {
    body.maxmindAccountId = accountId.trim();
    body.maxmindKey = licenseKey.trim();
    if (!body.maxmindAccountId || !body.maxmindKey) {
      actionError = "Enter your MaxMind account ID and license key.";
      return;
    }
  }
  if (mode === "ipinfo") {
    body.ipinfoToken = token.trim();
    if (!body.ipinfoToken) {
      actionError = "Enter your IPInfo token.";
      return;
    }
  }
  starting = true;
  const res = await api("POST", "/settings/ipdb/download", body);
  starting = false;
  if (!res?.success) {
    actionError = res?.error || "The download didn't start. Try again.";
    return;
  }
  updateOpen = false;
  licenseKey = "";
  token = "";
  watch();
};

const remove = async () => {
  const ok = await confirm({
    title: "Delete the location database?",
    message:
      "Country and network lookups stop unless your proxy sends location headers.",
    confirmText: "Delete database",
    danger: true,
  });
  if (!ok) return;
  const res = await api("DELETE", "/settings/ipdb");
  if (!res?.success) actionError = res?.error || "Couldn't delete the database";
  await load();
  await refreshSettings();
};
</script>

{#snippet credentials(m)}
  {#if m === "maxmind"}
    <div class="flex w-full flex-col gap-4 md:max-w-sm">
      <Field label="MaxMind account ID" for="mm-account">
        <Input id="mm-account" inputmode="numeric" autocomplete="off" bind:value={accountId} />
      </Field>
      <Field label="License key" for="mm-key">
        <Input id="mm-key" type="password" autocomplete="off" bind:value={licenseKey} />
      </Field>
    </div>
  {:else if m === "ipinfo"}
    <div class="flex w-full flex-col gap-4 md:max-w-sm">
      <Field label="IPInfo token" for="ipinfo-token">
        <Input id="ipinfo-token" type="password" autocomplete="off" bind:value={token} />
      </Field>
    </div>
  {/if}
{/snippet}

{#snippet cityRow(m)}
  {#if m !== "ipinfo"}
    <Row label="Look up cities" for="ipdb-cities" help="Adds the city to each event and puts city dots on the map. The city database takes 127 MB on disk and about as much memory.">
      <Switch
        id="ipdb-cities"
        bind:checked={cities}
        disabled={!!progress || starting}
        onchange={() => {
          if (!active) return;
          if (data.mode === "dbip") start();
          else updateOpen = true;
        }}
      />
    </Row>
  {/if}
{/snippet}

{#snippet status()}
  {#if actionError || serverError || loadError}
    <p class="text-sm text-destructive md:text-end" role="alert">{actionError || serverError || loadError}</p>
  {/if}
  {#if progress}
    <div class="flex w-full flex-col gap-1.5 md:max-w-sm" role="status">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="truncate">{progress.file ? `Downloading ${progress.file}` : "Starting download"}</span>
        <span class="text-muted-foreground tabular-nums">{percent === null ? bytes(progress.downloaded) : `${percent}%`}</span>
      </div>
      <div class="relative h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Download progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent ?? undefined}>
        {#if percent === null}
          <div class="ipdb-wait absolute inset-y-0 left-0 w-2/5 rounded-full bg-primary"></div>
        {:else}
          <div class="ipdb-fill h-full origin-left rounded-full bg-primary" style="transform: scaleX({percent / 100})"></div>
        {/if}
      </div>
    </div>
  {/if}
{/snippet}

<Skeleton loading={!data && !loadError} label="Loading the location database status">
  {#if data && active}
    <Row
      label={PROVIDERS[data.mode]?.[0] ?? data.mode}
      help={[
        data.lastUpdated && `Updated ${ago(Date.parse(data.lastUpdated))}.`,
        data.country?.exists && `${data.country.city ? "Cities" : "Countries"} ${bytes(data.country.size)}${data.loaded?.country ? "" : ", not loaded"}.`,
        data.asn?.exists && `Networks ${bytes(data.asn.size)}${data.loaded?.asn ? "" : ", not loaded"}.`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Health tone="ok" class="me-2">Active</Health>
        <Button
          disabled={!!progress || starting}
          onclick={() => {
            if (data.mode === "dbip" || updateOpen) start();
            else updateOpen = true;
          }}
        >
          {#if progress || starting}<Spinner label="Updating" />{/if}
          {progress ? "Updating" : starting ? "Starting" : updateOpen ? "Download update" : "Update"}
        </Button>
        {#if updateOpen}
          <Button variant="ghost" onclick={() => (updateOpen = false)}>Cancel</Button>
        {:else}
          <Button variant="danger-ghost" disabled={!!progress || starting} onclick={remove}>Delete</Button>
        {/if}
      </div>
      {#snippet below()}
        {#if updateOpen}
          <p class="text-sm text-muted-foreground md:text-end">Enter your credentials again to download a fresh copy.</p>
          {@render credentials(data.mode)}
        {/if}
        {@render status()}
      {/snippet}
    </Row>
    {@render cityRow(data.mode)}
  {:else}
    <Row label="Location database" for="ipdb-provider" help={PROVIDERS[provider][1]}>
      <Select
        id="ipdb-provider"
        bind:value={provider}
        options={Object.entries(PROVIDERS).map(([value, [title]]) => [value, title])}
      />
      {#snippet below()}
        {@render credentials(provider)}
        <div>
          <Button variant="primary" disabled={!!progress || starting} onclick={start}>
            {#if progress || starting}<Spinner label="Downloading" />{/if}
            {progress ? "Downloading" : starting ? "Starting download" : provider === "ipinfo" ? "Connect IPInfo" : `Download ${PROVIDERS[provider][0]}`}
          </Button>
        </div>
        {@render status()}
      {/snippet}
    </Row>
    {@render cityRow(provider)}
{/if}
</Skeleton>

<style>
  .ipdb-wait {
    transform: translateX(75%);
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: no-preference) {
    .ipdb-fill {
      transition: transform 0.4s var(--ease-out);
    }

    .ipdb-wait {
      opacity: 1;
      animation: ipdb-wait 1.4s var(--ease-in-out) infinite;
    }
  }

  @keyframes ipdb-wait {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
</style>
