<script>
import {
  Button,
  Field,
  Icon,
  Input,
  Row,
  Select,
  Skeleton,
  Spinner,
  Tag,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { ago, bytes } from "../../lib/format.js";
import { t } from "../../lib/i18n.svelte.js";
import { refreshSettings } from "../../lib/state.svelte.js";
import { confirm } from "../../lib/ui.svelte.js";

const PROVIDERS = $derived({
  dbip: ["DB-IP Lite", t("Free, no account needed.")],
  maxmind: [
    "MaxMind GeoLite2",
    t("Free, needs a MaxMind account and license key."),
  ],
  ipinfo: [
    "IPInfo",
    t("Looks visitors up through the IPInfo API with your token."),
  ],
});

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
  const body = { mode };
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
    title: t("Delete the location database?"),
    message: t(
      "Country and network lookups stop unless your proxy sends location headers.",
    ),
    confirmText: t("Delete database"),
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
      <Field label={t("MaxMind account ID")} for="mm-account">
        <Input id="mm-account" inputmode="numeric" autocomplete="off" bind:value={accountId} />
      </Field>
      <Field label={t("License key")} for="mm-key">
        <Input id="mm-key" type="password" autocomplete="off" bind:value={licenseKey} />
      </Field>
    </div>
  {:else if m === "ipinfo"}
    <div class="flex w-full flex-col gap-4 md:max-w-sm">
      <Field label={t("IPInfo token")} for="ipinfo-token">
        <Input id="ipinfo-token" type="password" autocomplete="off" bind:value={token} />
      </Field>
    </div>
  {/if}
{/snippet}

{#snippet status()}
  {#if actionError || serverError || loadError}
    <p class="text-sm text-destructive md:text-end" role="alert">{t(actionError || serverError || loadError)}</p>
  {/if}
  {#if progress}
    <div class="flex w-full flex-col gap-1.5 md:max-w-sm" role="status">
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="truncate">{progress.file ? t("Downloading {file}", { file: progress.file }) : t("Starting download")}</span>
        <span class="text-muted-foreground tabular-nums">{percent === null ? bytes(progress.downloaded) : `${percent}%`}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("Download progress")} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent ?? undefined}>
        <div class="h-full rounded-full bg-primary transition-[width] duration-300 {percent === null ? 'opacity-40' : ''}" style="width: {percent ?? 100}%"></div>
      </div>
    </div>
  {/if}
{/snippet}

<Skeleton loading={!data && !loadError} label={t("Loading the location database status")}>
  {#if data && active}
    <Row
      label={PROVIDERS[data.mode]?.[0] ?? data.mode}
      help={[
        data.lastUpdated && t("Updated {time}.", { time: ago(Date.parse(data.lastUpdated)) }),
        data.country?.exists &&
          (data.loaded?.country
            ? t("Countries {size}.", { size: bytes(data.country.size) })
            : t("Countries {size}, not loaded.", { size: bytes(data.country.size) })),
        data.asn?.exists &&
          (data.loaded?.asn
            ? t("Networks {size}.", { size: bytes(data.asn.size) })
            : t("Networks {size}, not loaded.", { size: bytes(data.asn.size) })),
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div class="flex flex-wrap items-center gap-2">
        <Tag tone="success"><Icon name="check" size={12} stroke={2.5} />{t("Active")}</Tag>
        <Button
          disabled={!!progress || starting}
          onclick={() => {
            if (data.mode === "dbip" || updateOpen) start();
            else updateOpen = true;
          }}
        >
          {#if progress || starting}<Spinner label={t("Updating")} />{/if}
          {progress ? t("Updating") : starting ? t("Starting") : updateOpen ? t("Download update") : t("Update")}
        </Button>
        {#if updateOpen}
          <Button variant="ghost" onclick={() => (updateOpen = false)}>{t("Cancel")}</Button>
        {:else}
          <Button variant="danger-ghost" disabled={!!progress || starting} onclick={remove}>{t("Delete")}</Button>
        {/if}
      </div>
      {#snippet below()}
        {#if updateOpen}
          <p class="text-sm text-muted-foreground md:text-end">{t("Enter your credentials again to download a fresh copy.")}</p>
          {@render credentials(data.mode)}
        {/if}
        {@render status()}
      {/snippet}
    </Row>
  {:else}
    <Row label={t("Location database")} for="ipdb-provider" help={PROVIDERS[provider][1]}>
      <Select
        id="ipdb-provider"
        bind:value={provider}
        options={Object.entries(PROVIDERS).map(([value, [title]]) => [value, title])}
      />
      {#snippet below()}
        {@render credentials(provider)}
        <div>
          <Button variant="primary" disabled={!!progress || starting} onclick={start}>
            {#if progress || starting}<Spinner label={t("Downloading")} />{/if}
            {progress ? t("Downloading") : starting ? t("Starting download") : provider === "ipinfo" ? t("Connect IPInfo") : t("Download {provider}", { provider: PROVIDERS[provider][0] })}
          </Button>
        </div>
        {@render status()}
      {/snippet}
    </Row>
{/if}
</Skeleton>
