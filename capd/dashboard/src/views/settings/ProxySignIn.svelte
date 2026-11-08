<script>
import {
  Button,
  CopyText,
  Field,
  Input,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import { api } from "../../lib/api.js";
import { toast } from "../../lib/ui.svelte.js";

let loaded = $state(null);
let mode = $state("off");
let header = $state("X-Cap-Proxy-Secret");
let secret = $state("");
let saving = $state(false);
let rotating = $state(false);

const load = async () => {
  const res = await api("GET", "/settings/proxy-auth");
  if (res?.error) return;
  loaded = res;
  mode = res.mode;
  header = res.header;
};
load();

const cleanHeader = $derived(header.trim() || "X-Cap-Proxy-Secret");
const dirty = $derived(
  !!loaded && (mode !== loaded.mode || cleanHeader !== loaded.header),
);

const save = async () => {
  saving = true;
  const res = await api("PUT", "/settings/proxy-auth", {
    mode,
    header: cleanHeader,
  });
  saving = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't save proxy sign-in", "error");
    return;
  }
  await load();
  toast("Proxy sign-in saved");
};

const rotate = async () => {
  rotating = true;
  const res = await api("POST", "/settings/proxy-auth/secret");
  rotating = false;
  if (!res?.success) {
    toast(res?.error || "Couldn't generate a secret", "error");
    return;
  }
  secret = res.secret;
  await load();
};
</script>

<div class="flex flex-col divide-y divide-border">
  <Row
    label="Sign in through a proxy"
    help="For a dashboard behind Authentik, Authelia or another sign-in proxy. The proxy sends a secret header, and Cap signs in whoever it lets through."
  >
    <Segmented
      class="self-start md:self-auto"
      label="Proxy sign-in"
      bind:value={mode}
      options={[
        ["off", "Off"],
        ["allow", "Proxy or admin key"],
        ["require", "Proxy only"],
      ]}
    />
    {#snippet below()}
      {#if mode === "require"}
        <p class="text-sm text-pretty text-muted-foreground md:text-end">The admin key stops working on the sign-in page, and every dashboard request needs the header. API keys keep working.</p>
      {/if}
      {#if dirty}
        <div class="flex items-center gap-3">
          <span class="text-sm text-muted-foreground" role="status">Unsaved changes</span>
          <Button variant="primary" disabled={saving} onclick={save}>{saving ? "Saving" : "Save proxy sign-in"}</Button>
        </div>
      {/if}
    {/snippet}
  </Row>

  <Row label="Header and secret" help="Set your proxy to add this header with the secret on requests it has already signed in.">
    <div class="flex w-full flex-col gap-4 md:max-w-sm">
      <Field label="Header name" for="proxy-header">
        <Input id="proxy-header" mono placeholder="X-Cap-Proxy-Secret" bind:value={header} />
      </Field>
      {#if secret}
        <Field label="Secret" for="proxy-secret" help="Copy it now. Cap only keeps a hash, so you can't see it again.">
          <CopyText value={secret} label="Copy secret" secret />
        </Field>
        <div class="flex flex-col gap-1.5">
          <p class="text-sm font-medium">Caddy example</p>
          <CopyText value={`header_up ${cleanHeader} ${secret}`} label="Copy Caddy line" secret />
        </div>
      {/if}
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button disabled={rotating || !loaded} onclick={rotate}>
          {rotating ? "Generating" : loaded?.hasSecret ? "Replace secret" : "Generate secret"}
        </Button>
        {#if loaded?.hasSecret}
          <span class="text-sm text-muted-foreground" role="status">
            {loaded.requestPasses ? "This page came through your proxy." : "This page didn't come with the header."}
          </span>
        {/if}
      </div>
    </div>
  </Row>
</div>
