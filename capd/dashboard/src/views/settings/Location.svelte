<script>
import {
  Button,
  Field,
  Input,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { t } from "../../lib/i18n.svelte.js";
import { app, refreshSettings } from "../../lib/state.svelte.js";
import { toast } from "../../lib/ui.svelte.js";
import IpDatabase from "./IpDatabase.svelte";

const presets = $derived([
  [
    "cloudflare",
    "Cloudflare",
    {
      ipHeader: "CF-Connecting-IP",
      countryHeader: "CF-IPCountry",
      asnHeader: "CF-IPOrg",
    },
  ],
  [
    "vercel",
    "Vercel",
    {
      ipHeader: "X-Forwarded-For",
      countryHeader: "X-Vercel-IP-Country",
      asnHeader: "",
    },
  ],
  [
    "nginx",
    "Nginx",
    {
      ipHeader: "X-Real-IP",
      countryHeader: "X-GeoIP2-Country",
      asnHeader: "X-GeoIP2-Org",
    },
  ],
  ["none", t("No proxy"), { ipHeader: "", countryHeader: "", asnHeader: "" }],
]);

const initial = {
  ipHeader: app.settings.headers?.ipHeader || "",
  countryHeader: app.settings.headers?.countryHeader || "",
  asnHeader: app.settings.headers?.asnHeader || "",
};
let saved = $state(initial);
let form = $state({ ...initial });
let source = $state(
  initial.countryHeader && !app.settings.ipdb?.mode ? "headers" : "ipdb",
);
let saving = $state(false);
let editHeaders = $state(false);

const clean = $derived({
  ipHeader: form.ipHeader.trim(),
  countryHeader: form.countryHeader.trim(),
  asnHeader: form.asnHeader.trim(),
});
const dirty = $derived(Object.keys(clean).some((k) => clean[k] !== saved[k]));
const preset = $derived(
  presets.find(([, , p]) =>
    Object.keys(p).every((k) => p[k] === clean[k]),
  )?.[0],
);

const save = async () => {
  saving = true;
  const res = await api("PUT", "/settings/headers", clean);
  saving = false;
  if (!res?.success) {
    toast(t(res?.error || "Couldn't save proxy settings"), "error");
    return;
  }
  saved = { ...clean };
  await refreshSettings();
  toast(t("Proxy settings saved"));
};
</script>

<div class="flex flex-col divide-y divide-border">
  <Row label={t("Your proxy or CDN")} help={t("Pick the one in front of Cap so it sees each visitor's real address, not the proxy's.")}>
    <Segmented
        class="self-start md:self-auto"
      label={t("Proxy or CDN")}
      value={preset}
      options={presets.map(([id, label]) => [id, label])}
      onchange={(v) => {
        const p = presets.find(([id]) => id === v);
        if (p) form = { ...p[2] };
      }}
    />
    {#snippet below()}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-end">
        {#if !preset}<span class="text-sm text-muted-foreground">{t("Using your own header names")}</span>{/if}
        <Button variant="link" aria-expanded={editHeaders} onclick={() => (editHeaders = !editHeaders)}>
          {editHeaders ? t("Hide header names") : t("Edit header names")}
        </Button>
      </div>
      {#if editHeaders}
        <div class="flex w-full flex-col gap-4 md:max-w-sm">
          <Field label={t("Visitor IP header")} for="ip-header" help={t("Used for rate limits, IP lists and location lookups.")}>
            <Input id="ip-header" mono placeholder="CF-Connecting-IP" bind:value={form.ipHeader} />
          </Field>
          <Field label={t("Country header")} for="country-header" help={t("Holds a two-letter country code.")}>
            <Input id="country-header" mono placeholder="CF-IPCountry" bind:value={form.countryHeader} />
          </Field>
          <Field label={t("Network header")} for="asn-header" help={t("Holds the network number or name.")}>
            <Input id="asn-header" mono placeholder="CF-IPOrg" bind:value={form.asnHeader} />
          </Field>
        </div>
      {/if}
      {#if dirty}
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted-foreground" role="status">{t("Unsaved changes")}</span>
          <Button variant="primary" disabled={saving} onclick={save}>{saving ? t("Saving") : t("Save proxy settings")}</Button>
        </div>
      {/if}
    {/snippet}
  </Row>

  <Row
    label={t("Where location comes from")}
    help={source === "ipdb"
      ? t("Cap downloads a free database and looks each visitor up itself.")
      : t("Cap reads the country your proxy already sends with each request.")}
  >
    <Segmented
        class="self-start md:self-auto"
      label={t("Location source")}
      bind:value={source}
      options={[
        ["ipdb", t("Database on this server")],
        ["headers", t("My proxy")],
      ]}
    />
    {#snippet below()}
      {#if source === "headers"}
        {#if saved.countryHeader}
          <p class="text-sm text-muted-foreground md:text-end">
            {t("Country from")} <code class="font-mono text-sm text-foreground">{saved.countryHeader}</code>{#if saved.asnHeader}{t(", network from")} <code class="font-mono text-sm text-foreground">{saved.asnHeader}</code>{/if}{t(".")}
          </p>
        {:else}
          <p class="text-sm text-muted-foreground md:text-end">{t("Pick your proxy above and save first.")}</p>
        {/if}
      {/if}
    {/snippet}
  </Row>

  {#if source === "ipdb"}
    <IpDatabase />
  {/if}
</div>
