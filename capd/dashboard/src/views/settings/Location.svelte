<script>
import {
  Button,
  Field,
  Input,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { app, refreshSettings } from "../../lib/state.svelte.js";
import SaveBar from "../../polish/instance-settings/SaveBar.svelte";
import IpDatabase from "./IpDatabase.svelte";

const presets = [
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
  ["none", "No proxy", { ipHeader: "", countryHeader: "", asnHeader: "" }],
];

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
let error = $state("");
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
  error = "";
  saving = true;
  const res = await api("PUT", "/settings/headers", clean);
  saving = false;
  if (!res?.success) {
    error = res?.error || "Couldn't save proxy settings";
    return false;
  }
  saved = { ...clean };
  await refreshSettings();
};
</script>

<div class="flex flex-col divide-y divide-border">
  <Row label="Your proxy or CDN" help="So Cap sees each visitor's real IP.">
    <Segmented
      class="self-start md:self-auto"
      label="Proxy or CDN"
      value={preset}
      options={presets.map(([id, label]) => [id, label])}
      onchange={(v) => {
        const p = presets.find(([id]) => id === v);
        if (p) form = { ...p[2] };
      }}
    />
    {#snippet below()}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2 md:justify-end">
        {#if !preset}<span class="text-sm text-muted-foreground">Using your own header names</span>{/if}
        <Button variant="link" class="px-0" aria-expanded={editHeaders} onclick={() => (editHeaders = !editHeaders)}>
          {editHeaders ? "Hide header names" : "Edit header names"}
        </Button>
      </div>
      {#if editHeaders}
        <div class="flex w-full flex-col gap-4 md:max-w-sm">
          <Field label="Visitor IP header" for="ip-header">
            <Input id="ip-header" mono placeholder="CF-Connecting-IP" bind:value={form.ipHeader} />
          </Field>
          <Field label="Country header" for="country-header" help="A two-letter country code.">
            <Input id="country-header" mono placeholder="CF-IPCountry" bind:value={form.countryHeader} />
          </Field>
          <Field label="Network header" for="asn-header" help="The network number or name.">
            <Input id="asn-header" mono placeholder="CF-IPOrg" bind:value={form.asnHeader} />
          </Field>
        </div>
      {/if}
      <SaveBar
        compact
        {dirty}
        {saving}
        {error}
        label="Save proxy settings"
        onsave={save}
        ondiscard={() => {
          error = "";
          form = { ...saved };
        }}
      />
    {/snippet}
  </Row>

  <Row
    label="Where location comes from"
    help={source === "ipdb"
      ? "Cap looks visitors up in a free database."
      : "Uses the country your proxy sends."}
  >
    <Segmented
      class="self-start md:self-auto"
      label="Location source"
      bind:value={source}
      options={[
        ["ipdb", "Database on this server"],
        ["headers", "My proxy"],
      ]}
    />
    {#snippet below()}
      {#if source === "headers"}
        {#if saved.countryHeader}
          <p class="text-sm text-muted-foreground md:text-end">
            Country from <code class="font-mono text-sm text-foreground">{saved.countryHeader}</code>{#if saved.asnHeader}, network from <code class="font-mono text-sm text-foreground">{saved.asnHeader}</code>{/if}.
          </p>
        {:else}
          <p class="text-sm text-muted-foreground md:text-end">Pick your proxy above and save first.</p>
        {/if}
      {/if}
    {/snippet}
  </Row>

  {#if source === "ipdb"}
    <div>
      <IpDatabase />
    </div>
  {/if}
</div>
